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

import {Material, Object3D} from 'three';

import {GLTF, GLTFElement} from '../../gltf-2.0.js';
import {SerializedThreeDOMElement} from '../../protocol.js';
import {getLocallyUniqueId} from '../../utilities.js';
import {ThreeDOMElement as ThreeDOMElementInterface} from '../api.js';

import {ModelGraft} from './model-graft.js';

export const $correlatedObjects = Symbol('correlatedObjects');
export const $type = Symbol('type');
export const $sourceObject = Symbol('sourceObject');

const $graft = Symbol('graft');
const $id = Symbol('id');

export type CorrelatedObjects = Set<Object3D>|Set<Material>;

/**
 * A SerializableThreeDOMElement is the common primitive of all scene graph
 * elements that have been facaded in the host execution context. It adds
 * a common interface to these elements in support of convenient
 * serializability.
 */
export class ThreeDOMElement implements ThreeDOMElementInterface {
  private[$graft]: ModelGraft;
  private[$sourceObject]: GLTFElement|GLTF;
  private[$correlatedObjects]: CorrelatedObjects|null;

  private[$id]: number = getLocallyUniqueId();

  constructor(
      graft: ModelGraft, element: GLTFElement|GLTF,
      correlatedObjects: CorrelatedObjects|null = null) {
    this[$graft] = graft;
    this[$sourceObject] = element;
    this[$correlatedObjects] = correlatedObjects;

    graft.adopt(this);
  }

  /**
   * The Model of provenance for this scene graph element.
   */
  get ownerModel() {
    return this[$graft].model;
  }

  /**
   * The unique ID that marks this element. In generally, an ID should only be
   * considered unique to the element in the context of its scene graph. These
   * IDs are not guaranteed to be stable across script executions.
   */
  get internalID() {
    return this[$id];
  }

  /**
   * Some (but not all) scene graph elements may have an optional name. The
   * Object3D.prototype.name property is sometimes auto-generated by Three.js.
   * We only want to expose a name that is set in the source glTF, so Three.js
   * generated names are ignored.
   */
  get name() {
    return (this[$sourceObject] as unknown as {name?: string}).name || null;
  }

  /**
   * The backing Three.js scene graph construct for this element.
   */
  get correlatedObjects() {
    return this[$correlatedObjects];
  }

  /**
   * The canonical GLTF or GLTFElement represented by this facade.
   */
  get sourceObject() {
    return this[$sourceObject];
  }

  toJSON(): SerializedThreeDOMElement {
    const serialized: SerializedThreeDOMElement = {id: this[$id]};
    const {name} = this;
    if (name != null) {
      serialized.name = name;
    }
    return serialized;
  }
}
