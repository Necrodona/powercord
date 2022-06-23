const { resolve } = require('path');
const { existsSync } = require('fs');
const { unlink } = require('fs').promises;
const { Plugin } = require('powercord/entities');
const { React, getModule, getModuleByDisplayName, constants: { Routes } } = require('powercord/webpack');
const { forceUpdateElement, getOwnerInstance, waitFor, findInReactTree } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { GUILD_ID, DISCORD_INVITE } = require('powercord/constants');

const ToastContainer = require('./components/ToastContainer');
const AnnouncementContainer = require('./components/AnnouncementContainer');

module.exports = class Notices extends Plugin {
  startPlugin () {
    this.loadStylesheet('style.scss');
    this._patchAnnouncements();
    this._patchToasts();

    const injectedFile = resolve(__dirname, '..', '..', '..', '__injected.txt');
    if (existsSync(injectedFile)) {
      this._welcomeNewUser();
      unlink(injectedFile);
    }

    if (window.GLOBAL_ENV.RELEASE_CHANNEL !== 'canary') {
      this._unsupportedBuild();
    }
  }

  pluginWillUnload () {
    uninject('pc-notices-announcements');
    uninject('pc-notices-toast');
  }

  async _patchAnnouncements () {
    const { base } = await getModule([ 'base', 'container' ]);
    const instance = getOwnerInstance(await waitFor(`.${base.split(' ')[0]}`));
    inject('pc-notices-announcements', instance.props.children[0], 'type', (_, res) => {
      const { children } = findInReactTree(res, ({ className }) => className === base);
      children.unshift(React.createElement(AnnouncementContainer));
      return res;
    });

    instance.forceUpdate();
  }

  async _patchToasts () {
    const { app } = await getModule([ 'app', 'layers' ]);
    const Shakeable = await getModuleByDisplayName('Shakeable');
    inject('pc-notices-toast', Shakeable.prototype, 'render', (_, res) => {
      if (!res.props.children.find(child => child.type && child.type.name === 'ToastContainer')) {
        res.props.children.push(React.createElement(ToastContainer));
      }
      return res;
    });
    forceUpdateElement(`.${app}`);
  }

  _unsupportedBuild () {
    powercord.api.notices.sendAnnouncement('pc-unsupported-build', {
      color: 'orange',
      message: `Powercord does not support the ${window.GLOBAL_ENV.RELEASE_CHANNEL} release of Discord. Please use Canary for best results.`
    });
  }
};
