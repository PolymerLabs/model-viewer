/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/**
 * @fileoverview Use lit-html to output a model-viewer tag with the current
 * settings applied to the GLB.
 */

import '@material/mwc-icon-button';

import {GltfModel, ModelViewerConfig, unpackGlb} from '@google/model-viewer-editing-adapter/lib/main.js'
import {createSafeObjectUrlFromArrayBuffer} from '@google/model-viewer-editing-adapter/lib/util/create_object_url.js'
import {radToDeg} from '@google/model-viewer-editing-adapter/lib/util/math.js'
import {safeDownloadCallback} from '@google/model-viewer-editing-adapter/lib/util/safe_download_callback.js'
import {ModelViewerElement} from '@google/model-viewer/lib/model-viewer';
import {customElement, html, internalProperty, PropertyValues, query} from 'lit-element';

import {reduxStore} from '../../space_opera_base.js';
import {extractStagingConfig, State} from '../../types.js';
import {applyCameraEdits, Camera, INITIAL_CAMERA} from '../camera_settings/camera_state.js';
import {dispatchModelViewerCameraChange} from '../camera_settings/reducer.js';
import {dispatchInitialCameraState} from '../camera_settings/reducer.js';
import {dispatchEnvrionmentImage} from '../config/reducer.js';
import {ConnectedLitElement} from '../connected_lit_element/connected_lit_element.js';
import {dispatchAddHotspot, dispatchSetHotspots, dispatchUpdateHotspotMode, generateUniqueHotspotName} from '../hotspot_panel/reducer.js';
import {HotspotConfig} from '../hotspot_panel/types.js';
import {createBlobUrlFromEnvironmentImage, dispatchAddEnvironmentImage} from '../ibl_selector/reducer.js';
import {dispatchConfig} from '../model_viewer_snippet/reducer.js';
import {styles as hotspotStyles} from '../utils/hotspot/hotspot.css.js';
import {renderHotspots} from '../utils/hotspot/render_hotspots.js';
import {renderModelViewer} from '../utils/render_model_viewer.js';

import {applyEdits} from './gltf_edits.js';
import {dispatchGltfAndEdits} from './gltf_edits.js';
import {styles} from './model_viewer_preview_styles.css.js';
import {dispatchGltfUrl} from './reducer.js';
import {GltfEdits, INITIAL_GLTF_EDITS} from './types.js';

const $edits = Symbol('edits');
const $gltfUrl = Symbol('gltfUrl');
const $gltf = Symbol('gltf');
const $autoplay = Symbol('autoplay');

export function getCameraState(viewer: ModelViewerElement) {
  const orbitRad = viewer.getCameraOrbit();
  return {
    orbit: {
      thetaDeg: radToDeg(orbitRad.theta),
      phiDeg: radToDeg(orbitRad.phi),
      radius: orbitRad.radius
    },
    target: viewer.getCameraTarget(),
    fieldOfViewDeg: viewer.getFieldOfView(),
  } as Camera;
}

async function downloadContents(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch url ${url}`);
  }
  const blob = await response.blob();
  if (!blob) {
    throw new Error(`Could not extract binary blob from response of ${url}`);
  }

  return blob.arrayBuffer();
}

/**
 * Renders and updates the model-viewer tag, serving as a preview of the edits.
 */
@customElement('model-viewer-preview')
export class ModelViewerPreview extends ConnectedLitElement {
  static styles = [styles, hotspotStyles];
  @query('model-viewer') readonly modelViewer?: ModelViewerElement;
  @internalProperty() config: ModelViewerConfig = {};
  @internalProperty() hotspots: HotspotConfig[] = [];
  @internalProperty() camera: Camera = INITIAL_CAMERA;
  @internalProperty() addHotspotMode = false;
  @internalProperty()[$autoplay]?: boolean;
  @internalProperty()[$edits]: GltfEdits = INITIAL_GLTF_EDITS;
  @internalProperty()[$gltf]?: GltfModel;
  @internalProperty()[$gltfUrl]?: string;
  @internalProperty() gltfError: string = '';

  stateChanged(state: State) {
    this.addHotspotMode = state.ui.hotspots.addHotspot || false;
    this.camera = state.entities.modelViewerSnippet.camera;
    this.config = state.entities.modelViewerSnippet.config;
    this.hotspots = state.entities.modelViewerSnippet.hotspots;
    this[$edits] = state.entities.gltfEdits.edits;
    this[$gltf] = state.entities.gltf.gltf;
    this[$gltfUrl] = state.entities.gltf.gltfUrl;
    this[$autoplay] = state.entities.modelViewerSnippet.config.autoplay;
  }

  firstUpdated() {
    this.addEventListener('drop', this.onDrop);
    this.addEventListener('dragover', this.onDragover);
  }

  private async onGltfUrlChanged() {
    if (!this.modelViewer) {
      throw new Error(`model-viewer element was not ready`);
    }

    // Clear potential poster settings.
    if (this.config.reveal === 'interaction' ||
        this.config.reveal === 'manual') {
      this.modelViewer.reveal = this.config.reveal;
    } else {
      this.modelViewer.reveal = 'auto';
    }
    this.modelViewer.poster = this.config.poster || '';

    const url = this[$gltfUrl];
    if (url) {
      try {
        this.gltfError = '';
        const glbContents = await downloadContents(url);

        const {gltfJson, gltfBuffer} = unpackGlb(glbContents);
        const gltf = new GltfModel(gltfJson, gltfBuffer, this.modelViewer);
        dispatchGltfAndEdits(gltf);
      } catch (error) {
        this.gltfError = error.message;
      }
    } else {
      dispatchGltfAndEdits(undefined);
    }
  }

  // We need to do different things depending on if both GLTF and edits changed,
  // or if only edits changed.
  private async updateGltf(gltfChanged: boolean, previousEdits?: GltfEdits) {
    // NOTE: There is a potential race here. If another update is running, we
    // may finish before it, and it would overwrite our correct results. We'll
    // live with this for now. If it becomes an issue, the proper solution is
    // probably to do async operations only at the data level, not affecting
    // the UI until data is ready.

    if (gltfChanged) {
      // Got a new GLTF, assume that previous edits were not applied yet.
      previousEdits = undefined;
    }

    const gltf = this[$gltf];
    if (gltf) {
      await applyEdits(gltf, this[$edits], previousEdits);
    }
  }

  protected updated(changedProperties: PropertyValues) {
    this.enforcePlayAnimation();

    if (changedProperties.has($gltfUrl)) {
      this.onGltfUrlChanged();
    }

    const previousEdits =
        changedProperties.get($edits) as GltfEdits | undefined;
    const gltfChanged = changedProperties.has($gltf);

    // Only call if needed - otherwise infinite-async-loops are possible.
    if (previousEdits || gltfChanged) {
      this.updateGltf(gltfChanged, previousEdits);
    }
  }

  protected render() {
    const editedConfig = {
      ...this.config,
      // If the gltf model has a URL, it must be more recent
      src: this[$gltf]?.getModelViewerSource() ?? this[$gltfUrl],
      // Always enable camera controls for preview
      cameraControls: true
    };
    applyCameraEdits(editedConfig, this.camera);

    const hasModel = !!editedConfig.src;

    const screenshotButton = !hasModel ? html`` : html
    `<mwc-icon-button icon="photo_camera" class="ScreenShotButton"
      title="Take screenshot"
      @click=${this.downloadScreenshot}>
    </mwc-icon-button>`;
    const childElements = [...renderHotspots(this.hotspots), screenshotButton];

    if (this.gltfError) {
      childElements.push(html`<div class="ErrorText">Error loading GLB:<br/>${
          this.gltfError}</div>`);
    } else if (!hasModel) {
      childElements.push(
          html
          `<div class="HelpText">Drag a GLB here!<br/><small>And HDRs for lighting</small></div>`);
    }

    return html`${
        renderModelViewer(
            editedConfig,
            {
              load: () => {
                this.onModelLoaded();
              },
              cameraChange: () => {
                this.onCameraChange();
              },
              modelVisibility: () => {
                this.onModelVisible();
              },
              // Other things can cause the animation to play/pause, like
              // setting autoplay to true, so make sure we enforce what WE want
              // after that.
              play: () => {
                this.enforcePlayAnimation();
              },
              pause: () => {
                this.enforcePlayAnimation();
              },
              click: (event: MouseEvent) => {
                if (this.addHotspotMode) {
                  this.addHotspot(event);
                }
              }
            },
            childElements)}`;
  }

  private onModelLoaded() {
    // Handle the case when the model is loaded for the first time.
    this.enforcePlayAnimation();
  }

  private onModelVisible() {
    if (!this.modelViewer || !this.modelViewer.loaded) {
      throw new Error('onModelVisible called before mv was loaded');
    }
    reduxStore.dispatch(
        dispatchInitialCameraState(getCameraState(this.modelViewer)));
  }

  private onCameraChange() {
    reduxStore.dispatch(dispatchModelViewerCameraChange());
  }

  private enforcePlayAnimation() {
    if (this.modelViewer && this.modelViewer.loaded) {
      // Calling play with no animation name will result in the first animation
      // getting played. Don't want that.
      if (this[$autoplay] && this.config.animationName) {
        this.modelViewer.play();
      } else {
        this.modelViewer.pause();
      }
    }
  }

  private addHotspot(event: MouseEvent) {
    if (!this.modelViewer) {
      throw new Error('Model Viewer doesn\'t exist');
    }
    const rect = this.modelViewer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const positionAndNormal = this.modelViewer.positionAndNormalFromPoint(x, y);
    if (!positionAndNormal) {
      throw new Error('invalid click position');
    }
    reduxStore.dispatch(dispatchAddHotspot({
      name: generateUniqueHotspotName(),
      position: positionAndNormal.position,
      normal: positionAndNormal.normal,
    }));
    reduxStore.dispatch(dispatchUpdateHotspotMode(false));
  }

  private async downloadScreenshot() {
    if (!this.modelViewer)
      return;
    safeDownloadCallback(
        await this.modelViewer.toBlob(), 'Space Opera Screenshot.png', '')();
  }

  private onDragover(event: DragEvent) {
    if (!event.dataTransfer)
      return;

    event.stopPropagation();
    event.preventDefault();
  }

  private async onDrop(event: DragEvent) {
    event.stopPropagation();
    event.preventDefault();

    if (event.dataTransfer && event.dataTransfer.items[0].kind === 'file') {
      const file = event.dataTransfer.items[0].getAsFile();
      if (!file)
        return;
      if (file.name.match(/\.(glb)$/i)) {
        const arrayBuffer = await file.arrayBuffer();
        const url = createSafeObjectUrlFromArrayBuffer(arrayBuffer).unsafeUrl;
        reduxStore.dispatch(dispatchGltfUrl(url));
        dispatchConfig(extractStagingConfig(this.config));
        reduxStore.dispatch(dispatchSetHotspots([]));
      }
      if (file.name.match(/\.(hdr|png|jpg|jpeg)$/i)) {
        const unsafeUrl = await createBlobUrlFromEnvironmentImage(file);

        reduxStore.dispatch(
            dispatchAddEnvironmentImage({uri: unsafeUrl, name: file.name}));
        reduxStore.dispatch(dispatchEnvrionmentImage(unsafeUrl));
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'model-viewer-preview': ModelViewerPreview;
  }
}
