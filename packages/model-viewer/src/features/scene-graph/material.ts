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

import {MeshStandardMaterial, Texture as ThreeTexture} from 'three';

import {GLTF, Material as GLTFMaterial} from '../../three-components/gltf-instance/gltf-2.0.js';

import {Material as MaterialInterface, RGB} from './api.js';
import {PBRMetallicRoughness} from './pbr-metallic-roughness.js';
import {TextureInfo, TextureUsage} from './texture-info.js';
import {$correlatedObjects, $onUpdate, $sourceObject, ThreeDOMElement} from './three-dom-element.js';



const $pbrMetallicRoughness = Symbol('pbrMetallicRoughness');
const $normalTexture = Symbol('normalTexture');
const $occlusionTexture = Symbol('occlusionTexture');
const $emissiveTexture = Symbol('emissiveTexture');
const $backingThreeMaterial = Symbol('backingThreeMaterial');

/**
 * Material facade implementation for Three.js materials
 */
export class Material extends ThreeDOMElement implements MaterialInterface {
  private[$pbrMetallicRoughness]: PBRMetallicRoughness;

  private[$normalTexture]: TextureInfo;
  private[$occlusionTexture]: TextureInfo;
  private[$emissiveTexture]: TextureInfo;
  get[$backingThreeMaterial](): MeshStandardMaterial {
    return (this[$correlatedObjects] as Set<MeshStandardMaterial>)
        .values()
        .next()
        .value;
  }
  constructor(
      onUpdate: () => void, gltf: GLTF, gltfMaterial: GLTFMaterial,
      correlatedMaterials: Set<MeshStandardMaterial>|undefined) {
    super(onUpdate, gltfMaterial, correlatedMaterials);

    if (correlatedMaterials == null) {
      return;
    }

    if (gltfMaterial.pbrMetallicRoughness == null) {
      gltfMaterial.pbrMetallicRoughness = {};
    }
    this[$pbrMetallicRoughness] = new PBRMetallicRoughness(
        onUpdate, gltf, gltfMaterial.pbrMetallicRoughness, correlatedMaterials);

    if (gltfMaterial.emissiveFactor == null) {
      gltfMaterial.emissiveFactor = [0, 0, 0];
    }

    let {normalTexture, occlusionTexture, emissiveTexture} = gltfMaterial;

    let normalTextures: ThreeTexture|null = null;
    let occlusionTextures: ThreeTexture|null = null;
    let emissiveTextures: ThreeTexture|null = null;

    const {normalMap, aoMap, emissiveMap} =
        correlatedMaterials.values().next().value;

    if (normalTexture != null && normalMap != null) {
      normalTextures = normalMap;
    } else {
      normalTexture = {index: -1};
    }

    if (occlusionTexture != null && aoMap != null) {
      occlusionTextures = aoMap;
    } else {
      occlusionTexture = {index: -1};
    }

    if (emissiveTexture != null && emissiveMap != null) {
      emissiveTextures = emissiveMap;
    } else {
      emissiveTexture = {index: -1};
    }

    for (const gltfMaterial of correlatedMaterials) {
      const {
        normalMap: verifyNormalMap,
        aoMap: verifyAoMap,
        emissiveMap: verifyEmissiveMap
      } = gltfMaterial;
      if (verifyNormalMap !== normalMap) {
        console.error('Normal map differs between homegenous materials');
      }
      if (verifyAoMap !== aoMap) {
        console.error('AO map differs between homegenous materials');
      }
      if (verifyEmissiveMap !== emissiveMap) {
        console.error('Emissive map differs between homegenous materials');
      }
    }

    this[$normalTexture] = new TextureInfo(
        onUpdate,
        gltf,
        correlatedMaterials,
        normalTextures,
        TextureUsage.Normal,
        normalTexture!);

    this[$occlusionTexture] = new TextureInfo(
        onUpdate,
        gltf,
        correlatedMaterials,
        occlusionTextures,
        TextureUsage.Occlusion,
        occlusionTexture!);

    this[$emissiveTexture] = new TextureInfo(
        onUpdate,
        gltf,
        correlatedMaterials,
        emissiveTextures,
        TextureUsage.Emissive,
        emissiveTexture!);
  }

  get name(): string {
    return (this[$sourceObject] as any).name || '';
  }

  get pbrMetallicRoughness(): PBRMetallicRoughness {
    return this[$pbrMetallicRoughness];
  }

  get normalTexture(): TextureInfo {
    return this[$normalTexture];
  }

  get occlusionTexture(): TextureInfo {
    return this[$occlusionTexture];
  }

  get emissiveTexture(): TextureInfo {
    return this[$emissiveTexture];
  }

  get emissiveFactor(): RGB {
    return (this[$sourceObject] as GLTFMaterial).emissiveFactor!;
  }

  setEmissiveFactor(rgb: RGB) {
    for (const material of this[$correlatedObjects] as
         Set<MeshStandardMaterial>) {
      material.emissive.fromArray(rgb);
    }
    (this[$sourceObject] as GLTFMaterial).emissiveFactor = rgb;
    this[$onUpdate]();
  }
}
