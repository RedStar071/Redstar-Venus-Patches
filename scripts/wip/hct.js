    // HCT (hue, chroma, tone): the color space Material You builds its palettes in. A small port of Google's
    // material-color-utilities (Apache-2.0): Cam16 for reading a color, HctSolver for making one at a given tone.
    const HCT_WHITE = [95.047, 100.0, 108.883];
    function hctLinear(c) { const n = c / 255; return (n <= 0.040449936 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)) * 100; }
    function hctDelinear(c) { const n = c / 100, d = n <= 0.0031308 ? n * 12.92 : 1.055 * Math.pow(n, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(d * 255))); }
    function hctLabF(t) { return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; }
    function hctLabInv(ft) { const c = ft * ft * ft; return c > 216 / 24389 ? c : (116 * ft - 16) / (24389 / 27); }
    function hctYFromTone(tone) { return 100 * hctLabInv((tone + 16) / 116); }
    function hctToneOf(rgb) { return 116 * hctLabF((0.2126 * hctLinear(rgb[0]) + 0.7152 * hctLinear(rgb[1]) + 0.0722 * hctLinear(rgb[2])) / 100) - 16; }
    const HCT_VC = (() => {
        const w = HCT_WHITE, La = 200 / Math.PI * hctYFromTone(50) / 100, f = 1, c = 0.69;
        const rW = w[0] * 0.401288 + w[1] * 0.650173 + w[2] * -0.051461, gW = w[0] * -0.250268 + w[1] * 1.204414 + w[2] * 0.045854,
            bW = w[0] * -0.002079 + w[1] * 0.048952 + w[2] * 0.953127;
        const d = Math.max(0, Math.min(1, f * (1 - 1 / 3.6 * Math.exp((-La - 42) / 92))));
        const rgbD = [d * 100 / rW + 1 - d, d * 100 / gW + 1 - d, d * 100 / bW + 1 - d];
        const k = 1 / (5 * La + 1), k4 = k * k * k * k, k4F = 1 - k4, fl = k4 * La + 0.1 * k4F * k4F * Math.cbrt(5 * La);
        const n = hctYFromTone(50) / w[1], z = 1.48 + Math.sqrt(n), nbb = 0.725 / Math.pow(n, 0.2);
        const af = [rW, gW, bW].map((v, i) => Math.pow(fl * rgbD[i] * v / 100, 0.42)), a = af.map(v => 400 * v / (v + 27.13));
        return {n, aw:(2 * a[0] + a[1] + 0.05 * a[2]) * nbb, nbb, ncb:nbb, c, nc:f, rgbD, fl, z};
    })();
    // Hue (degrees), chroma and tone of an sRGB color.
    function hctFromRgb(rgb) {
        const V = HCT_VC, r = hctLinear(rgb[0]), g = hctLinear(rgb[1]), b = hctLinear(rgb[2]);
        const x = 0.41233895 * r + 0.35762064 * g + 0.18051042 * b, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = 0.01932141 * r + 0.11916382 * g + 0.95034478 * b;
        const cone = [0.401288 * x + 0.650173 * y - 0.051461 * z, -0.250268 * x + 1.204414 * y + 0.045854 * z, -0.002079 * x + 0.048952 * y + 0.953127 * z];
        const ad = cone.map((v, i) => { const d = V.rgbD[i] * v, p = Math.pow(V.fl * Math.abs(d) / 100, 0.42); return Math.sign(d) * 400 * p / (p + 27.13); });
        const A = (11 * ad[0] - 12 * ad[1] + ad[2]) / 11, B = (ad[0] + ad[1] - 2 * ad[2]) / 9, u = (20 * ad[0] + 20 * ad[1] + 21 * ad[2]) / 20, p2 = (40 * ad[0] + 20 * ad[1] + ad[2]) / 20;
        const hue = ((Math.atan2(B, A) * 180 / Math.PI) % 360 + 360) % 360;
        const j = 100 * Math.pow(p2 * V.nbb / V.aw, V.c * V.z), huePrime = hue < 20.14 ? hue + 360 : hue;
        const t = 50000 / 13 * 0.25 * (Math.cos(huePrime * Math.PI / 180 + 2) + 3.8) * V.nc * V.ncb * Math.sqrt(A * A + B * B) / (u + 0.305);
        const chroma = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, V.n), 0.73) * Math.sqrt(j / 100);
        return {hue, chroma, tone:hctToneOf(rgb)};
    }
    const HCT_DISCOUNT = [[0.001200833568784504, 0.002389694492170889, 0.0002795742885861124], [0.0005891086651375999, 0.0029785502573438758, 0.0003270666104008398],
        [0.00010146692491640572, 0.0005364214359186694, 0.0032979401770712076]];
    const HCT_UNDISCOUNT = [[1373.2198709594231, -1100.4251190754821, -7.278681089101213], [-271.815969077903, 559.6580465940733, -32.46047482791194],
        [1.9622899599665666, -57.173814538844006, 308.7233197812385]];
    const HCT_Y = [0.2126, 0.7152, 0.0722];
    function hctMul(row, m) { return [row[0] * m[0][0] + row[1] * m[0][1] + row[2] * m[0][2], row[0] * m[1][0] + row[1] * m[1][1] + row[2] * m[1][2], row[0] * m[2][0] + row[1] * m[2][1] + row[2] * m[2][2]]; }
    function hctRgbFromLinear(l) { return [hctDelinear(l[0]), hctDelinear(l[1]), hctDelinear(l[2])]; }
    function hctAdapt(c) { const a = Math.pow(Math.abs(c), 0.42); return Math.sign(c) * 400 * a / (a + 27.13); }
    function hctHueOf(lin) { const s = hctMul(lin, HCT_DISCOUNT), r = hctAdapt(s[0]), g = hctAdapt(s[1]), b = hctAdapt(s[2]); return Math.atan2((r + g - 2 * b) / 9, (11 * r - 12 * g + b) / 11); }
    function hctRad(a) { return (a + Math.PI * 8) % (Math.PI * 2); }
    function hctCyclic(a, b, c) { return hctRad(b - a) < hctRad(c - a); }
    function hctVertex(y, n) {
        const A = n % 4 <= 1 ? 0 : 100, B = n % 2 === 0 ? 0 : 100, ok = v => v >= 0 && v <= 100;
        if (n < 4) { const r = (y - A * HCT_Y[1] - B * HCT_Y[2]) / HCT_Y[0]; return ok(r) ? [r, A, B] : null; }
        if (n < 8) { const g = (y - B * HCT_Y[0] - A * HCT_Y[2]) / HCT_Y[1]; return ok(g) ? [B, g, A] : null; }
        const b = (y - A * HCT_Y[0] - B * HCT_Y[1]) / HCT_Y[2]; return ok(b) ? [A, B, b] : null;
    }
    function hctTrueDelinear(c) { const n = c / 100; return (n <= 0.0031308 ? n * 12.92 : 1.055 * Math.pow(n, 1 / 2.4) - 0.055) * 255; }
    // The most colorful color of this hue at this lightness, when the asked-for chroma is out of the sRGB gamut.
    function hctBisect(y, hue) {
        let left = null, right = null, lh = 0, rh = 0, uncut = true;
        for (let n = 0; n < 12; n++) {
            const mid = hctVertex(y, n);
            if (!mid) continue;
            const mh = hctHueOf(mid);
            if (!left) { left = right = mid; lh = rh = mh; continue; }
            if (uncut || hctCyclic(lh, mh, rh)) {
                uncut = false;
                if (hctCyclic(lh, hue, mh)) { right = mid; rh = mh; } else { left = mid; lh = mh; }
            }
        }
        lh = hctHueOf(left);
        for (let axis = 0; axis < 3; axis++) {
            if (left[axis] === right[axis]) continue;
            let lp, rp;
            if (left[axis] < right[axis]) { lp = Math.floor(hctTrueDelinear(left[axis]) - 0.5); rp = Math.ceil(hctTrueDelinear(right[axis]) - 0.5); }
            else { lp = Math.ceil(hctTrueDelinear(left[axis]) - 0.5); rp = Math.floor(hctTrueDelinear(right[axis]) - 0.5); }
            for (let i = 0; i < 8 && Math.abs(rp - lp) > 1; i++) {
                const mp = Math.floor((lp + rp) / 2), coord = hctLinear(mp + 0.5), t = (coord - left[axis]) / (right[axis] - left[axis]);
                const mid = [left[0] + (right[0] - left[0]) * t, left[1] + (right[1] - left[1]) * t, left[2] + (right[2] - left[2]) * t], mh = hctHueOf(mid);
                if (hctCyclic(lh, hue, mh)) { right = mid; rp = mp; } else { left = mid; lh = mh; lp = mp; }
            }
        }
        return [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, (left[2] + right[2]) / 2];
    }
    function hctInverseAdapt(a) { const abs = Math.abs(a), base = Math.max(0, 27.13 * abs / (400 - abs)); return Math.sign(a) * Math.pow(base, 1 / 0.42); }
    function hctByJ(hue, chroma, y) {
        const V = HCT_VC, tInner = 1 / Math.pow(1.64 - Math.pow(0.29, V.n), 0.73), p1 = 0.25 * (Math.cos(hue + 2) + 3.8) * (50000 / 13) * V.nc * V.ncb;
        const hSin = Math.sin(hue), hCos = Math.cos(hue);
        let j = Math.sqrt(y) * 11;
        for (let round = 0; round < 5; round++) {
            const jn = j / 100, alpha = chroma === 0 || j === 0 ? 0 : chroma / Math.sqrt(jn), t = Math.pow(alpha * tInner, 1 / 0.9);
            const p2 = V.aw * Math.pow(jn, 1 / V.c / V.z) / V.nbb, gamma = 23 * (p2 + 0.305) * t / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
            const a = gamma * hCos, b = gamma * hSin;
            const lin = hctMul([hctInverseAdapt((460 * p2 + 451 * a + 288 * b) / 1403), hctInverseAdapt((460 * p2 - 891 * a - 261 * b) / 1403),
                hctInverseAdapt((460 * p2 - 220 * a - 6300 * b) / 1403)], HCT_UNDISCOUNT);
            if (lin[0] < 0 || lin[1] < 0 || lin[2] < 0) return null;
            const fnj = HCT_Y[0] * lin[0] + HCT_Y[1] * lin[1] + HCT_Y[2] * lin[2];
            if (fnj <= 0) return null;
            if (round === 4 || Math.abs(fnj - y) < 0.002) return lin[0] > 100.01 || lin[1] > 100.01 || lin[2] > 100.01 ? null : hctRgbFromLinear(lin);
            j = j - (fnj - y) * j / (2 * fnj);
        }
        return null;
    }
    // An sRGB color with this hue and tone, as close to the chroma as the gamut allows.
    function hctToRgb(hueDeg, chroma, tone) {
        if (chroma < 0.0001 || tone < 0.0001 || tone > 99.9999) { const v = hctDelinear(hctYFromTone(tone)); return [v, v, v]; }
        const hue = ((hueDeg % 360) + 360) % 360 / 180 * Math.PI, y = hctYFromTone(tone);
        return hctByJ(hue, chroma, y) || hctRgbFromLinear(hctBisect(y, hue));
    }
