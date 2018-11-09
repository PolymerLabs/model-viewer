/*
 * Copyright 2018 Google Inc. All Rights Reserved.
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

import {ARMixin} from './features/ar.js';
import {AutoRotateMixin} from './features/auto-rotate.js';
import {ControlsMixin} from './features/controls.js';
import {EnvironmentMixin} from './features/environment.js';
import {LoadingMixin} from './features/loading.js';
import {MagicLeapMixin} from './features/magic-leap.js';
import ModelViewerElementBase from './model-viewer-element-base.js';

import template from './template.js';

if (window.ShadyCSS) {
  window.ShadyCSS.prepareTemplate(template, 'model-viewer');
}

const ModelViewerElement = [
  LoadingMixin,
  ARMixin,
  AutoRotateMixin,
  EnvironmentMixin,
  ControlsMixin,
  MagicLeapMixin
].reduce((Base, Mixin) => Mixin(Base), ModelViewerElementBase);

customElements.define('model-viewer', ModelViewerElement);
