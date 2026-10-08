/* =========================================================================
   SAKURA LISTA — interaksi & animasi
   Semua animasi digerbang `html.motion-ok` (dipasang di <head>), sehingga
   tanpa JS atau dengan reduced-motion seluruh konten tetap terlihat.
   ========================================================================= */
(function () {
  "use strict";

  var html = document.documentElement;
  var motionOk = html.classList.contains("motion-ok");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };


  /* ---------- 0. PEMUAT TERTUNDA (data-src) -----------------------------
     Slide hero ke-2..5 dan dokumentasi ke-2..7 memakai data-src: tidak ada
     alasan 1,1 MB gambar yang baru tampil 7 detik kemudian ikut jalur kritis.
     Diminta setelah halaman idle, dan dipaksa muat tepat sebelum tampil. */
  function muat(img) {
    if (!img || !img.dataset.src) return;
    img.src = img.dataset.src;
    delete img.dataset.src;
  }
  function muatDalam(el) {
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll("img[data-src]"), muat);
  }
  (function tertunda() {
    var sisa = function () {
      Array.prototype.forEach.call(
        document.querySelectorAll("img[data-src]"), muat);
    };
    var mulai = function () {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(sisa, { timeout: 3000 });
      } else {
        setTimeout(sisa, 900);
      }
    };
    // Tunggu 'load' dulu: idle callback bisa menyala sebelum cat terbesar
    // selesai, dan itu mengembalikan gambar tunda ke jalur kritis.
    if (document.readyState === "complete") setTimeout(mulai, 700);
    else window.addEventListener("load", function () { setTimeout(mulai, 700); });
  })();

  /* ---------- 1. SPLASH (sekali per sesi) -------------------------------- */
  (function splash() {
    var el = $("#splash");
    if (!el) return;
    var sudah = false;
    try { sudah = sessionStorage.getItem("sl_splash") === "1"; } catch (e) {}
    if (sudah || !motionOk) {
      el.remove();          // sudah pernah tampil sesi ini, atau reduced-motion
      return;
    }
    try { sessionStorage.setItem("sl_splash", "1"); } catch (e) {}
    setTimeout(function () {
      el.classList.add("pergi");
      setTimeout(function () { el.remove(); }, 800);
    }, 1250);
  })();

  /* ---------- 2. PECAH JUDUL PER KARAKTER -------------------------------
     Dilakukan sebelum paint berikutnya dan animasinya murni CSS, supaya
     elemen LCP tetap tercat lebih awal (JS di teks atas-layar menunda LCP).

     PENTING: tiap karakter jadi `inline-block`, dan browser BOLEH memutus
     baris di antara dua inline-block. Tanpa pembungkus per kata, hasilnya
     "Berangkat ke Je / pang" — kata terbelah di tengah. Karena itu setiap
     KATA dibungkus `.kata` (white-space: nowrap), baru hurufnya dipecah di
     dalamnya. Spasi antar kata jadi elemen sendiri supaya tetap bisa putus. */
  (function pecah() {
    $$("[data-pecah]").forEach(function (node) {
      var frag = document.createDocumentFragment();
      var i = 0;

      function bungkusKata(teks, wadah) {
        // pecah jadi token: kata dan spasi, spasi dipertahankan sebagai pemisah
        var token = teks.split(/(\s+)/);
        token.forEach(function (tk) {
          if (!tk) return;
          if (/^\s+$/.test(tk)) {
            wadah.appendChild(document.createTextNode(" "));
            return;
          }
          var kata = document.createElement("span");
          kata.className = "kata";
          for (var k = 0; k < tk.length; k++) {
            var hr = document.createElement("span");
            hr.className = "hr";
            hr.textContent = tk[k];
            hr.style.setProperty("--i", i++);
            kata.appendChild(hr);
          }
          wadah.appendChild(kata);
        });
      }

      Array.prototype.forEach.call(node.childNodes, function (anak) {
        if (anak.nodeType === 3) {
          bungkusKata(anak.textContent, frag);
        } else if (anak.nodeType === 1) {
          var klon = anak.cloneNode(false);
          bungkusKata(anak.textContent, klon);
          frag.appendChild(klon);
        }
      });

      node.textContent = "";
      node.appendChild(frag);
      node.classList.add("pecah");
    });
  })();

  /* ---------- 3. SMOOTH SCROLL (Lenis-style, tanpa dependensi) ----------
     rAF lerp pada window.scrollY. Dimatikan di layar sentuh — momentum
     native iOS/Android jauh lebih baik daripada emulasi JS. */
  var lenis = null;
  (function smooth() {
    if (!motionOk) return;
    if (matchMedia("(hover: none)").matches) return;
    if (window.innerWidth < 900) return;

    var target = window.scrollY;
    var now = target;
    var aktif = false;
    var EASE = 0.095;

    function loop() {
      var d = target - now;
      if (Math.abs(d) < 0.4) {
        now = target;
        aktif = false;
      } else {
        now += d * EASE;
        aktif = true;
      }
      window.scrollTo(0, now);
      if (aktif) requestAnimationFrame(loop);
    }

    function mulai() {
      if (!aktif) {
        aktif = true;
        requestAnimationFrame(loop);
      }
    }

    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return;
      if ($("#drawer").classList.contains("on")) return;
      if ($("#lb").classList.contains("on")) return;
      e.preventDefault();
      var maks = document.documentElement.scrollHeight - window.innerHeight;
      target = Math.max(0, Math.min(maks, target + e.deltaY));
      mulai();
    }, { passive: false });

    // Sinkron ulang kalau scroll datang dari sumber lain (keyboard, anchor).
    window.addEventListener("scroll", function () {
      if (!aktif) { target = now = window.scrollY; }
    }, { passive: true });

    lenis = {
      ke: function (y) {
        target = y;
        now = window.scrollY;
        mulai();
      }
    };
  })();

  /* ---------- 4. ANCHOR HALUS + OFFSET HEADER --------------------------- */
  (function anchor() {
    var tinggiHdr = 74;
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id === "#" || id.length < 2) return;
        var t = document.getElementById(id.slice(1));
        if (!t) return;
        e.preventDefault();
        tutupDrawer();
        var y = t.getBoundingClientRect().top + window.scrollY - tinggiHdr + 1;
        y = Math.max(0, y);
        if (lenis) {
          lenis.ke(y);
        } else {
          window.scrollTo({ top: y, behavior: motionOk ? "smooth" : "auto" });
        }
      });
    });
  })();

  /* ---------- 5. HEADER + PROGRESS + FAB + NAV AKTIF -------------------- */
  (function scrollUI() {
    var hdr = $("#hdr");
    var bar = $("#progress");
    var fab = $("#fab");
    var tautan = $$(".nav a");
    var seksi = tautan.map(function (a) {
      return document.getElementById(a.getAttribute("href").slice(1));
    });
    var tick = false;

    function hitung() {
      var y = window.scrollY;
      var maks = document.documentElement.scrollHeight - window.innerHeight;

      hdr.classList.toggle("turun", y > 18);
      bar.style.width = (maks > 0 ? (y / maks) * 100 : 0) + "%";
      fab.classList.toggle("on", y > window.innerHeight * 0.55);

      // nav aktif: section yang menutupi garis 40% viewport
      var garis = y + window.innerHeight * 0.4;
      var aktifIdx = -1;
      for (var i = 0; i < seksi.length; i++) {
        var s = seksi[i];
        if (!s) continue;
        var atas = s.offsetTop;
        if (garis >= atas && garis < atas + s.offsetHeight) aktifIdx = i;
      }
      tautan.forEach(function (a, i) {
        if (i === aktifIdx) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      tick = false;
    }

    window.addEventListener("scroll", function () {
      if (!tick) {
        tick = true;
        requestAnimationFrame(hitung);
      }
    }, { passive: true });
    hitung();
  })();

  /* ---------- 6. REVEAL ON SCROLL --------------------------------------- */
  (function reveal() {
    var item = $$(".rv");
    if (!motionOk || !("IntersectionObserver" in window)) {
      item.forEach(function (el) { el.classList.add("tampil"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("tampil");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -11% 0px", threshold: 0.08 });
    item.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- 7. ANGKA STATISTIK MERAYAP -------------------------------- */
  (function angka() {
    var el = $$("[data-angka]");
    if (!el.length) return;
    if (!motionOk || !("IntersectionObserver" in window)) {
      el.forEach(function (b) { b.textContent = isi(b, 1); });
      return;
    }
    function isi(b, p) {
      var t = parseFloat(b.dataset.angka);
      var n = Math.round(t * p);
      var s = b.dataset.plain ? String(n) : n.toLocaleString("id-ID");
      return s + (b.dataset.suffix || "");
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        var b = e.target;
        io.unobserve(b);
        var t0 = performance.now();
        var dur = 1500;
        (function step(t) {
          var p = Math.min(1, (t - t0) / dur);
          var easy = 1 - Math.pow(1 - p, 3);
          b.textContent = isi(b, easy);
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.5 });
    el.forEach(function (b) { io.observe(b); });
  })();

  /* ---------- 8. HERO: LATAR 5 SLIDE ----------------------------------- */
  (function heroLatar() {
    var fig = $$("#heroFoto figure");
    var dots = $$("#heroDots button");
    if (fig.length < 2) return;
    var idx = 0;
    var timer = null;
    var JEDA = 7000;

    function ke(n) {
      idx = (n + fig.length) % fig.length;
      muatDalam(fig[idx]);
      muatDalam(fig[(idx + 1) % fig.length]);   // siapkan slide berikutnya
      fig.forEach(function (f, i) { f.classList.toggle("on", i === idx); });
      dots.forEach(function (d, i) {
        d.setAttribute("aria-selected", i === idx ? "true" : "false");
      });
    }
    function jalan() {
      stop();
      if (!motionOk) return;
      timer = setInterval(function () { ke(idx + 1); }, JEDA);
    }
    function stop() { if (timer) clearInterval(timer); timer = null; }

    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { ke(i); jalan(); });
    });
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : jalan();
    });
    jalan();
  })();

  /* ---------- 9. HERO: CAROUSEL DOKUMENTASI ---------------------------- */
  (function heroDok() {
    var fig = $$("#dok .hero-dok-bingkai figure");
    var no = $("#dokNo");
    var cap = $("#dokCap");
    if (!fig.length || !no) return;

    var teks = fig.map(function (f) {
      return $("img", f).getAttribute("alt") || "";
    });
    var idx = 0;
    var timer = null;

    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function ke(n) {
      idx = (n + fig.length) % fig.length;
      muatDalam(fig[idx]);
      muatDalam(fig[(idx + 1) % fig.length]);
      fig.forEach(function (f, i) { f.classList.toggle("on", i === idx); });
      no.textContent = pad(idx + 1) + " / " + pad(fig.length);
      cap.textContent = teks[idx];
    }
    function jalan() {
      stop();
      if (!motionOk) return;
      timer = setInterval(function () { ke(idx + 1); }, 4600);
    }
    function stop() { if (timer) clearInterval(timer); timer = null; }

    $("#dokPrev").addEventListener("click", function () { ke(idx - 1); jalan(); });
    $("#dokNext").addEventListener("click", function () { ke(idx + 1); jalan(); });
    var dok = $("#dok");
    dok.addEventListener("mouseenter", stop);
    dok.addEventListener("mouseleave", jalan);
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : jalan();
    });
    ke(0);
    jalan();
  })();

  /* ---------- 10. ALUMNI: MARQUEE OTOMATIS TERUS-MENERUS --------------
     Versi lama memakai setInterval + maksIdx(): ia berhenti di kartu terakhir
     lalu melompat balik ke 0 (terbukti macet di translateX(-954px) selama
     >4 detik). Sekarang track digandakan dan digeser terus dengan rAF, jadi
     jalannya mulus dan tak pernah habis. Drag/tombol tetap bisa, dan setelah
     dilepas gerakan otomatis LANJUT sendiri — bukan mati permanen. */
  (function alumni() {
    var track = $("#alumTrack");
    if (!track) return;

    var asli = $$(".alum-kartu", track);
    if (!asli.length) return;
    var jml = asli.length;

    // Gandakan kartu supaya gulungan tak pernah kehabisan isi.
    // Salinan ditandai aria-hidden agar pembaca layar tidak membacanya dua kali.
    for (var g = 0; g < 2; g++) {
      asli.forEach(function (k) {
        var kl = k.cloneNode(true);
        kl.setAttribute("aria-hidden", "true");
        kl.classList.add("salinan");
        track.appendChild(kl);
      });
    }

    var no = $("#alumNo");
    var garis = $("#alumGaris");
    var jeda = false;        // hover / drag / tab tersembunyi
    var x = 0;               // posisi geser (px)
    var LAJU = 38;           // px per detik
    var last = 0;
    var satu = 0;            // lebar satu putaran

    function ukurSatu() {
      if (asli.length < 2) return asli[0].offsetWidth;
      var gap = asli[1].offsetLeft - asli[0].offsetLeft;
      return gap * jml;
    }

    function pad(n) { return (n < 10 ? "0" : "") + n; }

    function labeli() {
      var gap = satu / jml || 1;
      var i = ((Math.round(-x / gap) % jml) + jml) % jml;
      no.textContent = pad(i + 1) + " / " + pad(jml);
      garis.style.transform = "scaleX(" + Math.max(0.1, (i + 1) / jml) + ")";
    }

    function gambar(t) {
      if (!last) last = t;
      var dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!jeda && motionOk) {
        x -= LAJU * dt;
        if (satu && -x >= satu) x += satu;      // putar tanpa lompatan
        track.style.transform = "translateX(" + x + "px)";
        labeli();
      }
      requestAnimationFrame(gambar);
    }

    function geserKartu(arah) {
      var gap = satu / jml || 1;
      x -= arah * gap;
      if (satu) {
        while (-x >= satu) x += satu;
        while (x > 0) x -= satu;
      }
      track.style.transition = "transform .6s " +
        "cubic-bezier(.16,1,.3,1)";
      track.style.transform = "translateX(" + x + "px)";
      labeli();
      setTimeout(function () { track.style.transition = ""; }, 620);
    }

    $("#alumPrev").addEventListener("click", function () { geserKartu(-1); });
    $("#alumNext").addEventListener("click", function () { geserKartu(1); });

    // Hover hanya MENJEDA; begitu kursor keluar, jalan lagi sendiri.
    var rel = track.parentElement;
    rel.addEventListener("mouseenter", function () { jeda = true; });
    rel.addEventListener("mouseleave", function () { jeda = false; });
    document.addEventListener("visibilitychange", function () {
      jeda = document.hidden;
      last = 0;
    });

    // drag / swipe
    var x0 = null, xMulai = 0, drag = false;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = true; jeda = true; x0 = e.clientX; xMulai = x;
      track.style.transition = "none";
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      x = xMulai + (e.clientX - x0);
      track.style.transform = "translateX(" + x + "px)";
    }, { passive: true });
    function lepas() {
      if (!drag) return;
      drag = false;
      track.style.transition = "";
      if (satu) {
        while (-x >= satu) x += satu;
        while (x > 0) x -= satu;
      }
      labeli();
      jeda = false;       // LANJUT otomatis, tidak mati permanen
      last = 0;
    }
    window.addEventListener("pointerup", lepas);
    window.addEventListener("pointercancel", lepas);

    function ulangUkur() {
      satu = ukurSatu();
      labeli();
    }
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(ulangUkur, 160);
    });

    // Tunggu gambar/font settle sebelum mengukur lebar putaran.
    if (document.readyState === "complete") setTimeout(ulangUkur, 300);
    else window.addEventListener("load", function () { setTimeout(ulangUkur, 300); });
    ulangUkur();

    if (motionOk) requestAnimationFrame(gambar);
    else labeli();
  })();

  /* ---------- 11. DRAWER (focus trap + ESC) ---------------------------- */
  var fokusTerakhir = null;
  function bukaDrawer() {
    var d = $("#drawer"), s = $("#scrim"), b = $("#burger");
    fokusTerakhir = document.activeElement;
    s.hidden = false;
    requestAnimationFrame(function () {
      d.classList.add("on");
      s.classList.add("on");
    });
    d.setAttribute("aria-hidden", "false");
    b.setAttribute("aria-expanded", "true");
    b.setAttribute("aria-label", "Tutup menu");
    document.body.style.overflow = "hidden";
    $("#drawerX").focus();
  }
  function tutupDrawer() {
    var d = $("#drawer"), s = $("#scrim"), b = $("#burger");
    if (!d.classList.contains("on")) return;
    d.classList.remove("on");
    s.classList.remove("on");
    d.setAttribute("aria-hidden", "true");
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", "Buka menu");
    document.body.style.overflow = "";
    setTimeout(function () { s.hidden = true; }, 420);
    if (fokusTerakhir) fokusTerakhir.focus();
  }
  $("#burger").addEventListener("click", bukaDrawer);
  $("#drawerX").addEventListener("click", tutupDrawer);
  $("#scrim").addEventListener("click", tutupDrawer);

  /* ---------- 12. LIGHTBOX --------------------------------------------- */
  (function lightbox() {
    var lb = $("#lb"), img = $("#lbimg"), cap = $("#lbcap"), x = $("#lbx");
    var pemicu = null;

    function buka(src, teks, dari) {
      pemicu = dari;
      img.src = src;
      img.alt = teks;
      cap.textContent = teks;
      lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add("on"); });
      document.body.style.overflow = "hidden";
      x.focus();
    }
    function tutup() {
      lb.classList.remove("on");
      document.body.style.overflow = "";
      setTimeout(function () { lb.hidden = true; img.src = ""; }, 420);
      if (pemicu) pemicu.focus();
    }
    $$("[data-lb]").forEach(function (b) {
      b.addEventListener("click", function () {
        buka(b.dataset.lb, b.dataset.cap || "", b);
      });
    });
    x.addEventListener("click", tutup);
    lb.addEventListener("click", function (e) { if (e.target === lb) tutup(); });
    lb._tutup = tutup;
  })();

  /* ---------- 13. KEYBOARD GLOBAL -------------------------------------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" && e.key !== "Tab") return;
    var lb = $("#lb"), d = $("#drawer");
    var modal = lb.classList.contains("on") ? lb :
                d.classList.contains("on") ? d : null;
    if (!modal) return;

    if (e.key === "Escape") {
      modal === lb ? lb._tutup() : tutupDrawer();
      return;
    }
    // focus trap
    var f = $$('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])', modal)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var pertama = f[0], akhir = f[f.length - 1];
    if (e.shiftKey && document.activeElement === pertama) {
      e.preventDefault(); akhir.focus();
    } else if (!e.shiftKey && document.activeElement === akhir) {
      e.preventDefault(); pertama.focus();
    }
  });

  /* ---------- 14. PARALLAX RINGAN PADA KANJI HERO ---------------------- */
  (function parallax() {
    if (!motionOk) return;
    if (matchMedia("(hover: none)").matches) return;
    var kanji = $(".hero-kanji");
    var ctaKanji = $(".cta-kanji");
    if (!kanji) return;
    var tick = false;
    window.addEventListener("scroll", function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        kanji.style.transform = "translateY(" + y * 0.14 + "px)";
        if (ctaKanji) {
          var r = ctaKanji.parentElement.getBoundingClientRect();
          var p = (window.innerHeight - r.top) / (window.innerHeight + r.height);
          ctaKanji.style.transform =
            "translate(-50%,-50%) translateY(" + (p - 0.5) * -60 + "px)";
        }
        tick = false;
      });
    }, { passive: true });
  })();

  /* ---------- 15. FALLBACK GAMBAR BELUM ADA ---------------------------
     Foto AI digenerate terpisah; kalau satu belum ada, jangan tampilkan
     ikon broken — ganti ke blok washi dengan kanji, dan tetap TODO. */
  $$("img").forEach(function (im) {
    im.addEventListener("error", function () {
      var w = im.getAttribute("width") || 600;
      var h = im.getAttribute("height") || 600;
      im.src =
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
          '<rect width="100%" height="100%" fill="#e4ddd0"/>' +
          '<text x="50%" y="52%" text-anchor="middle" font-size="' +
          Math.round(Math.min(w, h) * 0.26) +
          '" fill="#b8ab96" font-family="serif">桜</text></svg>'
        );
    });
  });
})();
