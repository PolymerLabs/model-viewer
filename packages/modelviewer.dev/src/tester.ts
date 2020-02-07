/* @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ModelViewerElement} from '@google/model-viewer';
import {SimpleDropzone} from 'simple-dropzone';

const viewer = document.getElementById('loading-demo') as ModelViewerElement;

const inputElement = document.querySelector('#input');
const dropControl = new SimpleDropzone(viewer, inputElement);
dropControl.on('drop', ({files}: any) => load(files));

(['src', 'environmentImage'] as Array<'src'|'environmentImage'>)
    .forEach((property) => {
      document.getElementById(`${property}`)!.addEventListener(
          'input', (event) => {
            viewer[property] = (event.target as HTMLInputElement).value;
            if (viewer.environmentImage === '') {
              useSkybox.disabled = true;
              useSkybox.checked = false;
              viewer.skyboxImage = null;
            } else {
              useSkybox.disabled = false;
            }
            if (useSkybox.checked) {
              viewer.skyboxImage = viewer.environmentImage;
            }
            if (property === 'src') {
              resetModel();
            }
          });
    });

function resetModel() {
  viewer.reveal = 'auto';
  viewer.dismissPoster();
  downloadButton.disabled = true;
  displayButton.disabled = true;
}

const useSkybox = document.getElementById('useSkybox') as HTMLInputElement;
useSkybox.addEventListener('change', (_event) => {
  if (useSkybox.checked) {
    viewer.skyboxImage = viewer.environmentImage;
  } else {
    viewer.skyboxImage = null;
  }
});

(['exposure', 'shadowIntensity', 'shadowSoftness'] as
 Array<'exposure'|'shadowIntensity'|'shadowSoftness'>)
    .forEach((property) => {
      const input = document.getElementById(`${property}`) as HTMLInputElement;
      const output =
          document.getElementById(`${property}Value`) as HTMLInputElement;
      input.addEventListener('input', (event) => {
        output.value = (event.target as HTMLInputElement).value;
        viewer[property] = parseFloat(output.value);
      });
      output.addEventListener('input', (event) => {
        input.value = (event.target as HTMLInputElement).value;
        viewer[property] = parseFloat(output.value);
      });
    });

(['autoRotate'] as Array<'autoRotate'>).forEach((property) => {
  const checkbox = document.getElementById(`${property}`) as HTMLInputElement;
  checkbox.addEventListener('change', (_event) => {
    viewer[property] = checkbox.checked;
  });
});

let posterUrl = '';
const a = document.createElement('a');
const downloadButton = document.getElementById('download') as HTMLButtonElement;
const displayButton = document.getElementById('display') as HTMLButtonElement;
downloadButton.disabled = true;
displayButton.disabled = true;
const orbitString = document.getElementById('cameraOrbit') as HTMLDivElement;

export async function createPoster() {
  const orbit = viewer.getCameraOrbit();
  orbitString.textContent = `${orbit.theta}rad ${orbit.phi}rad auto`;
  viewer.fieldOfView = 'auto';
  viewer.jumpCameraToGoal();
  await new Promise(resolve => requestAnimationFrame(() => resolve()));
  URL.revokeObjectURL(posterUrl);
  const blob = await viewer.toBlob({mimeType: 'image/png', idealAspect: true});
  posterUrl = URL.createObjectURL(blob);
  downloadButton.disabled = false;
  displayButton.disabled = false;
}

export function reloadScene() {
  viewer.poster = posterUrl;
  viewer.reveal = 'interaction';
  viewer.cameraOrbit = orbitString.textContent!;
  viewer.jumpCameraToGoal();
  const src = viewer.src;
  viewer.src = null;
  viewer.src = src;
}

export function downloadPoster() {
  a.href = posterUrl;
  a.download = 'poster.png';
  a.click();
}

export function addHotspot() {
  viewer.addEventListener('click', onClick);
}

export function removeHotspot() {
}

let hotspotCounter = 0;

function onClick(event: MouseEvent) {
  const rect = viewer.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hitResult = viewer.getHitResult(x, y);
  if (hitResult.position === '') {
    console.log('no hit result: mouse = ', x, ', ', y);
    return;
  }
  const hotspot = document.createElement('button');
  hotspot.slot = `hotspot-${hotspotCounter++}`;
  hotspot.classList.add('hotspot');
  hotspot.dataset.position = hitResult.position;
  hotspot.dataset.normal = hitResult.normal;
  viewer.appendChild(hotspot);
  viewer.removeEventListener('click', onClick);
}

(self as any).createPoster = createPoster;
(self as any).reloadScene = reloadScene;
(self as any).downloadPoster = downloadPoster;
(self as any).addHotspot = addHotspot;
(self as any).removeHotspot = removeHotspot;

function load(fileMap: Map<string, File>) {
  let rootPath: string;
  Array.from(fileMap).forEach(([path, file]) => {
    const filename = file.name.toLowerCase();
    if (filename.match(/\.(gltf|glb)$/)) {
      const blobURLs: Array<string> = [];
      rootPath = path.replace(file.name, '');

      ModelViewerElement.mapURLs((url: string) => {
        const index = url.lastIndexOf('/');

        const normalizedURL =
            rootPath + url.substr(index + 1).replace(/^(\.?\/)/, '');

        if (fileMap.has(normalizedURL)) {
          const blob = fileMap.get(normalizedURL);
          const blobURL = URL.createObjectURL(blob);
          blobURLs.push(blobURL);
          return blobURL;
        }

        return url;
      });

      viewer.addEventListener('load', () => {
        blobURLs.forEach(URL.revokeObjectURL);
      });

      const fileURL =
          typeof file === 'string' ? file : URL.createObjectURL(file);
      viewer.src = fileURL;
      resetModel();
    }
  });

  if (fileMap.size === 1) {
    const file = fileMap.values().next().value;
    const filename = file.name.toLowerCase();
    if (filename.match(/\.(hdr)$/)) {
      viewer.environmentImage = URL.createObjectURL(file) + '#.hdr';
    } else if (filename.match(/\.(png|jpg)$/)) {
      viewer.environmentImage = URL.createObjectURL(file);
    }
    if (useSkybox.checked) {
      viewer.skyboxImage = viewer.environmentImage;
    }
  }
}
