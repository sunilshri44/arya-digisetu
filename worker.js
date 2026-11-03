const encoder = new TextEncoder();

function b64url(bytes) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
async function makeSession(env) {
  const payload = b64url(encoder.encode(JSON.stringify({role:"admin", exp: Date.now() + 8*60*60*1000})));
  return `${payload}.${await sign(payload, env.AUTH_SECRET)}`;
}
async function validSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)arya_session=([^;]+)/);
  if (!match || !env.AUTH_SECRET) return false;
  const [payload, sig] = match[1].split(".");
  if (!payload || !sig || !(await sign(payload, env.AUTH_SECRET)).includes(sig) || (await sign(payload, env.AUTH_SECRET)) !== sig) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return data.role === "admin" && data.exp > Date.now();
  } catch { return false; }
}
function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {status, headers: {"content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...headers}});
}
function cookie(value, maxAge=28800) {
  return `arya_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
async function handleApi(request, env) {
  const url = new URL(request.url);
  if (!env.DB) return json({error:"Database binding DB is not configured."}, 500);

  if (url.pathname === "/api/register" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({error:"Invalid request."},400); }
    const full_name = String(body.full_name || "").trim().slice(0,100);
    const mobile = String(body.mobile || "").replace(/\D/g,"").slice(0,10);
    const email = String(body.email || "").trim().slice(0,120);
    const village = String(body.village || "").trim().slice(0,100);
    const tehsil = String(body.tehsil || "").trim().slice(0,100);
    const district = String(body.district || "Guna").trim().slice(0,100);
    if (full_name.length < 2 || mobile.length !== 10 || village.length < 2 || district.length < 2) {
      return json({error:"नाम, 10 अंकों का मोबाइल नंबर, गाँव और जिला सही भरें।"},400);
    }
    try {
      const result = await env.DB.prepare(
        "INSERT INTO agents (full_name,mobile,email,village,tehsil,district) VALUES (?,?,?,?,?,?)"
      ).bind(full_name,mobile,email,village,tehsil,district).run();
      return json({ok:true, id:result.meta.last_row_id, message:"आपका आवेदन प्राप्त हुआ है। Admin की जाँच के बाद स्थिति अपडेट होगी।"},201);
    } catch (e) {
      return json({error:"आवेदन सेव नहीं हो सका। कृपया बाद में प्रयास करें।"},500);
    }
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({error:"Invalid request."},400); }
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.AUTH_SECRET) return json({error:"Admin secrets are not configured."},500);
    if (String(body.username || "") !== env.ADMIN_USERNAME || String(body.password || "") !== env.ADMIN_PASSWORD) {
      return json({error:"गलत यूज़रनेम या पासवर्ड।"},401);
    }
    return json({ok:true},200,{"set-cookie":cookie(await makeSession(env))});
  }

  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    return json({ok:true},200,{"set-cookie":cookie("",0)});
  }

  if (url.pathname.startsWith("/api/admin/")) {
    if (!(await validSession(request,env))) return json({error:"कृपया Admin Login करें।"},401);
    if (url.pathname === "/api/admin/agents" && request.method === "GET") {
      const {results=[]} = await env.DB.prepare(
        "SELECT id,full_name,mobile,email,village,tehsil,district,status,created_at FROM agents ORDER BY id DESC LIMIT 300"
      ).all();
      return json({agents:results});
    }
    const action = url.pathname.match(/^\/api\/admin\/agents\/(\d+)\/(approve|reject)$/);
    if (action && request.method === "POST") {
      const status = action[2] === "approve" ? "APPROVED" : "REJECTED";
      const result = await env.DB.prepare("UPDATE agents SET status=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(status, Number(action[1])).run();
      if (!result.meta.changes) return json({error:"आवेदन नहीं मिला।"},404);
      return json({ok:true,status});
    }
  }
  return json({error:"Not found"},404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request,env);
    return env.ASSETS.fetch(request);
  }
};
