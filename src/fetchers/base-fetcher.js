/* @flow */
/* eslint no-unused-vars: 0 */

import type {PackageRemote, FetchedMetadata, FetchedOverride, Manifest} from '../types.js';
import type {RegistryNames} from '../registries/index.js';
import type Config from '../config.js';
import * as constants from '../constants.js';
import * as fs from '../util/fs.js';

const path = require('path');

export default class BaseFetcher {
  constructor(dest: string, remote: PackageRemote, config: Config) {
    this.reference = remote.reference;
    this.registry = remote.registry;
    this.hash = remote.hash;
    this.remote = remote;
    this.config = config;
    this.dest = dest;
  }

  remote: PackageRemote;
  registry: RegistryNames;
  reference: string;
  config: Config;
  hash: ?string;
  dest: string;

  getResolvedFromCached(hash: string): Promise<?string> {
    // fetcher subclasses may use this to perform actions such as copying over a cached tarball to the offline
    // mirror etc
    return Promise.resolve();
  }

  _fetch(): Promise<FetchedOverride> {
    return Promise.reject(new Error('Not implemented'));
  }

  fetch(): Promise<FetchedMetadata> {
    const {dest} = this;

    return fs.lockQueue.push(dest, async (): Promise<FetchedMetadata> => {
      await fs.mkdirp(dest);

      // fetch package and get the hash
      const {hash, resolved} = await this._fetch();

      // skip any readManifest operation for link type as dest might not exist yet
      if (this.remote.type === 'link') {
        const mockPkg: Manifest = {_uid: '', name: '', version: '0.0.0', _registry: this.registry};
        return Promise.resolve({resolved, hash, dest, package: mockPkg});
      }

      // load the new normalized manifest
      const pkg = await this.config.readManifest(dest, this.registry);

      await fs.writeFile(path.join(dest, constants.METADATA_FILENAME), JSON.stringify({
        remote: this.remote,
        registry: this.registry,
        hash,
      }, null, '  '));

      return {
        resolved,
        hash,
        dest,
        package: pkg,
        cached: false,
      };
    });
  }
}
