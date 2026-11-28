'use strict';

function fakeContext() {
  return new Proxy(
    {},
    {
      get(target, property) {
        if (property in target) return target[property];
        if (property === 'canvas') return { width: 480, height: 270 };
        return function () {};
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      }
    }
  );
}

function fakeCanvas() {
  const context = fakeContext();
  return {
    width: 480,
    height: 270,
    getContext() {
      return context;
    }
  };
}

function fakeSfx() {
  return {
    jump() {},
    land() {},
    gem() {},
    stomp() {},
    hurt() {},
    checkpoint() {},
    win() {},
    pause() {},
    click() {},
    timeShift() {}
  };
}

module.exports = { fakeContext, fakeCanvas, fakeSfx };
