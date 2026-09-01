import http from "node:http";

function api(method, path, body, token, ct) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: "localhost", port: 3001, path: "/api" + path, method, headers: {} };
    if (token) opts.headers["Authorization"] = "Bearer " + token;
    opts.headers["Content-Type"] = ct || "application/json";
    const req = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(d) }); }
        catch { resolve({ s: res.statusCode, b: d }); }
      });
    });
    req.on("error", reject);
    if (body && Buffer.isBuffer(body)) req.write(body);
    else if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let P = 0, F = 0;
function ok(n, v) { if (v) { P++; console.log("  ✅", n); } else { F++; console.log("  ❌", n); } }

console.log("\n🧪 STEP 1: Registration + Login");
const rA = await api("POST", "/auth/register", { username: "smoketest_a", password: "Test@123456", displayName: "A" });
ok("Register A →200", rA.s === 200);
const tA = rA.b?.token;
ok("Token A", !!tA);
const rB = await api("POST", "/auth/register", { username: "smoketest_b", password: "Test@123456", displayName: "B" });
ok("Register B →200", rB.s === 200);
const tB = rB.b?.token;
ok("Token B", !!tB);
const me = await api("GET", "/auth/me", null, tA);
ok("Profile correct", me.b?.user?.username === "smoketest_a" && me.b?.user?.isArtist === false);

console.log("\n🧪 STEP 2: Artist Application + Approval");
const ap = await api("POST", "/artist-applications", { artistName: "SmokeArtist", email: "t@t.com", mainGenre: "Pop", socialLinks: [] }, tA);
ok("Submit app →201 pending", ap.s === 201 && ap.b?.application?.status === "pending");
const aid = ap.b?.application?.id;

const ad = await api("POST", "/auth/login", { username: "haidang280611", password: "@280611" });
const at = ad.b?.token;
const av = await api("POST", "/admin/artist-applications/" + aid + "/approve", {}, at);
ok("Admin approve →200", av.s === 200);

const pr = await api("GET", "/artists/smoketest_a");
ok("Profile created", pr.b?.artist?.artistName === "SmokeArtist");
const me2 = await api("GET", "/auth/me", null, tA);
ok("isArtist = true", me2.b?.user?.isArtist === true);

console.log("\n🧪 STEP 3: Avatar + Cover Upload");
const bn = "----T" + Date.now();
function mp(f, fn, d) {
  return Buffer.concat([
    Buffer.from("--" + bn + "\r\nContent-Disposition: form-data; name=\"" + f + "\"; filename=\"" + fn + "\"\r\nContent-Type: image/png\r\n\r\n"),
    Buffer.from(d),
    Buffer.from("\r\n--" + bn + "--\r\n"),
  ]);
}
const ct = "multipart/form-data; boundary=" + bn;
const avU = await api("POST", "/artists/me/avatar", mp("avatar", "a.png", "AV_" + Date.now()), tA, ct);
ok("Avatar upload →200", avU.s === 200 && !!avU.b?.artist?.avatarUrl);
const cvU = await api("POST", "/artists/me/cover", mp("cover", "c.png", "CV_" + Date.now()), tA, ct);
ok("Cover upload →200", cvU.s === 200 && !!cvU.b?.artist?.coverUrl);
const fp = await api("GET", "/artists/smoketest_a");
ok("Avatar →/api/avatars/", fp.b?.artist?.avatarUrl?.includes("/api/avatars/"));
ok("Cover →/api/artwork/", fp.b?.artist?.coverUrl?.includes("/api/artwork/"));

console.log("\n🧪 STEP 4: Submit Music");
const ab = "----A" + Date.now();
let mb = "";  for (const [k, v] of Object.entries({ action: "create", title: "TestSong", releaseType: "single", genres: JSON.stringify(["Pop"]), language: "vi", isExplicit: "false", lyrics: "Hi", credits: "[]" }))
  mb += "--" + ab + "\r\nContent-Disposition: form-data; name=\"" + k + "\"\r\n\r\n" + v + "\r\n";
mb += "--" + ab + "\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"t.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n";
const mf = Buffer.concat([Buffer.from(mb), Buffer.alloc(1024, 0xFF), Buffer.from("\r\n--" + ab + "--\r\n")]);
const sub = await api("POST", "/submissions", mf, tA, "multipart/form-data; boundary=" + ab);
ok("Submit music →200/201", (sub.s === 200 || sub.s === 201) && !!sub.b?.submission?.id);

console.log("\n🧪 STEP 5: DB Records");
const ms = await api("GET", "/submissions/mine", null, tA);
ok("My subs ≥ 1", ms.b?.submissions?.length >= 1);
ok("artist_username correct", ms.b?.submissions?.[0]?.artistUsername === "smoketest_a");
ok("audioUrl or hasAudio", ms.b?.submissions?.[0]?.hasAudio === true);

console.log("\n🧪 STEP 6: Ownership Isolation");
const bs = await api("GET", "/submissions/mine", null, tB);
ok("User B sees 0 submissions", (bs.b?.submissions?.length === 0 || bs.b?.error));
const bu = await api("PUT", "/artists/me", { artistName: "Hacked" }, tB);
ok("User B cannot edit A profile", bu.s === 404);
const bn2 = "----X" + Date.now();
const bAv = await api("POST", "/artists/me/avatar", Buffer.concat([
  Buffer.from("--" + bn2 + "\r\nContent-Disposition: form-data; name=\"avatar\"; filename=\"x.png\"\r\nContent-Type: image/png\r\n\r\n"),
  Buffer.from("X"),
  Buffer.from("\r\n--" + bn2 + "--\r\n"),
]), tB, "multipart/form-data; boundary=" + bn2);
ok("User B cannot upload A avatar", bAv.s === 404);

console.log("\n═══════════════════════════════");
console.log("RESULTS:", P, "✅ passed,", F, "❌ failed");
console.log("═══════════════════════════════");
process.exit(F > 0 ? 1 : 0);
