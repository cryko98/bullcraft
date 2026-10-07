/* BullCraft — page scripts (nav, copy CA, splash, CSS block textures) */
(function () {
  // ---- Mobile nav ----
  var toggle = document.getElementById('navToggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('open'); }); });
  }

  // ---- Copy contract address ----
  var copyBtn = document.getElementById('copyCa');
  var caText = document.getElementById('caText');
  if (copyBtn && caText) {
    copyBtn.addEventListener('click', function () {
      var text = caText.textContent.trim();
      var done = function () { copyBtn.textContent = 'Copied!'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
      else done();
    });
  }

  // ---- Splash text ----
  var splashes = ['Moo-n soon!', 'Blocky bull!', 'Not a cow!', 'Diamonds? Gold!', 'Mine. Build. Moon.', 'Powered by Solana!', 'Hold the blocks!', 'Charge!', '100% cubic!', 'Herd mentality!', 'Creeper-free zone', 'Wen moo?'];
  var splash = document.getElementById('splash');
  if (splash) splash.textContent = splashes[Math.floor(Math.random() * splashes.length)];

  // ---- Procedural pixel textures for CSS backgrounds ----
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function makeTex(size, fn, seed) {
    var c = document.createElement('canvas'); c.width = size; c.height = size;
    var ctx = c.getContext('2d'); var img = ctx.createImageData(size, size); var r = rng(seed);
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var p = fn(x, y, r); var i = (y * size + x) * 4;
      img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return 'url(' + c.toDataURL() + ')';
  }
  function noisy(base, amt) { return function (x, y, r) { var n = (r() - 0.5) * amt; return [base[0] + n, base[1] + n, base[2] + n]; }; }
  var root = document.documentElement.style;
  root.setProperty('--dirt-tex', makeTex(16, noisy([121, 85, 61], 50), 1));
  root.setProperty('--grass-tex', makeTex(16, noisy([93, 158, 59], 46), 2));
  root.setProperty('--stone-tex', makeTex(16, function (x, y, r) { var v = r(); var b = v < 0.15 ? 95 : v > 0.85 ? 150 : 127; var n = (r() - 0.5) * 16; return [b + n, b + n, b + n]; }, 3));
  root.setProperty('--gold-tex', makeTex(16, function (x, y, r) { var edge = x === 0 || y === 0 || x === 15 || y === 15; var n = (r() - 0.5) * 24; if (edge) return [184 + n, 134 + n, 27 + n]; if ((x + y) % 7 === 0) return [255, 238, 150]; return [245 + n, 200 + n, 66 + n]; }, 4));
})();
