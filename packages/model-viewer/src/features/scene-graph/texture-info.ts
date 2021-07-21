/* @license
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
 */

import {LinearEncoding, MeshStandardMaterial, sRGBEncoding, Texture as ThreeTexture, TextureEncoding} from 'three';

import {TextureInfo as GLTFTextureInfo} from '../../three-components/gltf-instance/gltf-2.0.js';

import {TextureInfo as TextureInfoInterface} from './api.js';
import {$sourceTexture} from './image.js';
import {Texture} from './texture.js';
import {ThreeDOMElement} from './three-dom-element.js';



const $texture = Symbol('texture');
export const $materials = Symbol('materials');
export const $usage = Symbol('usage');

// Defines what a texture will be used for.
export enum TextureUsage {
  Base,
  Metallic,
  Normal,
  Occlusion,
  Emissive,
}

/**
 * TextureInfo facade implementation for Three.js materials
 */
export class TextureInfo extends ThreeDOMElement implements
    TextureInfoInterface {
  private[$texture]: Texture|null;

  // Holds a reference to the Three data that backs the material object.
  [$materials]: Set<MeshStandardMaterial>|null;

  // Texture usage defines the how the texture is used (ie Normal, Emissive...
  // etc)
  [$usage]: TextureUsage;
  onUpdate: () => void;

  constructor(
      onUpdate: () => void, textureUsage: TextureUsage = TextureUsage.Base,
      texture: Texture|null, material: Set<MeshStandardMaterial>|null,
      gltfTextureInfo: GLTFTextureInfo|null) {
    super(onUpdate, gltfTextureInfo, new Set<ThreeTexture>([]));

    this.onUpdate = onUpdate;
    this[$materials] = material;
    this[$usage] = textureUsage;
    this[$texture] = texture;
  }

  get texture(): Texture|null {
    return this[$texture];
  }

  setTexture(texture: Texture|null): void {
    const threeTexture: ThreeTexture|null =
        texture != null ? texture.source[$sourceTexture] : null;
    let encoding: TextureEncoding = sRGBEncoding;
    this[$texture] = texture;

    if (this[$materials]) {
      for (const material of this[$materials]!) {
        switch (this[$usage]) {
          case TextureUsage.Base:
            material.map = threeTexture;
            break;
          case TextureUsage.Metallic:
            encoding = LinearEncoding;
            material.metalnessMap = threeTexture;
            break;
          case TextureUsage.Normal:
            encoding = LinearEncoding;
            material.normalMap = threeTexture;
            break;
          case TextureUsage.Occlusion:
            encoding = LinearEncoding;
            material.aoMap = threeTexture;
            break;
          case TextureUsage.Emissive:
            material.emissiveMap = threeTexture;
            break;
          default:
        }
        material.needsUpdate = true;
      }
    }

    if (threeTexture) {
      // Updates the encoding for the texture, affects all references.
      threeTexture.encoding = encoding;
    }
    this.onUpdate();
  }
}
