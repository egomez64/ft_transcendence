import Fastify from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import staticPlugin from '@fastify/static';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import jwt from 'jsonwebtoken';

const   ROOT = process.cwd();
const   PAGES = path.join(ROOT, 'src', 'pages');
const   PUBLIC = ROOT;

async function readHtml(file: string) {
    return fs.readFile(path.join(PAGES, file), 'utf8');
}

async function render(page: string, opts: { title?: string; desc?: string; user?: any } = {}) {
    const layout = await readHtml('layout.html');
    let partial = await readHtml(page);

    //injection cote server
    if (page === 'dashboard.html' && opts.user?.username) {
        partial = partial.replace('id="dashUsername">.*?</span>', `id="dashUsername">${opts.user?.username ?? ''}</span>`);
    }

    //injecter la partielle
    let html = layout.replace(
        /<main id="app"[^>]*>[\s\S]*?<\/main>/,
        `<main id="app" class="relative z-0 min-h-screen text-pink-100 px-8 pt-16 pb-32" data-ssr="1">${partial}</main>`
    );

    //SEO 
    const title = opts.title ?? 'ft_transcendence';
    const desc = opts.desc ?? 'Pong synthwave - ft_transcendence';
    html = html.replace(/<title>.*<\/title>/, `<title>${title}</title>`);
    html = html.replace('</head>', ` <meta name="description" content="${desc}">\n</head>`);

    return html;
}

//ex recuperer un utilisateur avec cookie

function getUser(req: any): any | null {
    const raw = req.cookie?.access;
    if (!raw) return null;
    const ACCESS_JWT_SECRET = process.env.ACCESS_JWT_SECRET || 'dev-access';
    try {
        const payload: any = jwt.verify(raw, ACCESS_JWT_SECRET);
        return { id: payload.uid };
    } catch {
        return null
    }
}

const ROUTES: Record<string, { file: string; title: string; protected?: boolean }> = {
  '/':                      { file: 'home.html',                  title: 'Accueil - ft_transcendence' },
  '/home':                  { file: 'home.html',                  title: 'Accueil - ft_transcendence' },
  '/login':                 { file: 'login.html',                 title: 'Connexion - ft_transcendence' },
  '/register':              { file: 'register.html',              title: 'Inscription - ft_transcendence' },
  // tout le reste protégé :
  '/dashboard':             { file: 'dashboard.html',             title: 'Dashboard - ft_transcendence', protected: true },
  '/profils':               { file: 'profile.html',               title: 'Profil - ft_transcendence',     protected: true },
  '/friends':               { file: 'friends.html',               title: 'Amis - ft_transcendence',       protected: true },
  '/play':                  { file: 'play.html',                  title: 'Play - ft_transcendence',       protected: true },
  '/pong':                  { file: 'pong.html',                  title: 'Pong - ft_transcendence',       protected: true },
  '/1v1':                   { file: '1v1.html',                   title: '1v1 - ft_transcendence',        protected: true },
  '/twofa':                 { file: 'twofa.html',                 title: '2FA - ft_transcendence',        protected: false },
  '/tournament':            { file: 'tournament.html',            title: 'Tournament - ft_transcendence', protected: true },
  '/tournament/bracket':    { file: 'tournament-bracket.html',    title: 'Bracket - ft_transcendence',    protected: true },
  '/set-password':          { file: 'set-password.html',          title: 'Set password - ft_transcendence', protected: false },
};

const app = Fastify({ logger: false});

await app.register(compress);
await app.register(cookie);

await app.register(staticPlugin, { root: PUBLIC, prefix: '/', decorateReply: false });

await app.register(staticPlugin, {
    root: path.join(ROOT, 'uploads'),
    prefix: '/uploads/',
    decorateReply: false
});

for ( const route of Object.keys(ROUTES)) {
    app.get(route, async (req, rep) => {
        const def = ROUTES[route];
        if (!def) return rep.code(404).send('Not Found');

        const user = getUser(req);
        if (def.protected && !user) return rep.redirect('/login');

        const html = await render(def.file, { title: def.title, user });
        return rep.type('text/html').send(html);
    });
}

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.listen({ port: PORT, host: HOST })
    .then(() => console.log(`SSR server on http://${HOST}:${PORT}`))
    .catch(err => { console.error(err); process.exit(1); });