type Dict = Record<string, any>;

declare global {
	interface Window {
		__i18n?: {
			current: string;
			dict: Dict;
			ready: boolean;
		}
	}
}

const g = window as any;
if (!g.__i18n) {
	g.__i18n = {
		current: localStorage.getItem('lang')
			|| ((navigator?.language || '').startsWith('fr') ? 'fr' : 'en'),
		dict: {},
		ready: false
	};
}

const FALLBACK = 'en';

function get(obj: any, path: string): any {
	return path.split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), obj);	
}

function interpolate(str: string, vars?: Record<string, any>) {
	if (!vars) return str;
	return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]): `{${k}}`));
}

async function loadDict(l: string): Promise<Dict> {
	try {
		if (l === 'fr') return (await import('./i18n/fr.json')).default;
		if (l === 'es') return (await import('./i18n/es.json')).default;
		if (l === 'en') return (await import('./i18n/en.json')).default;
	} catch {}
	return (await import(`./i18n/${FALLBACK}.json`)).default;
}

export function lang() {
	return g.__i18n.current;
}

export async function setLang(l: string) {
	g.__i18n.current = l;
	localStorage.setItem('lang', l);
	g.__i18n.dict = await loadDict(l);
	g.__i18n.ready = true;
	document.documentElement.setAttribute('lang', l);
	applyTranslations();
}

export async function initI18n() {
	if (!g.__i18n.ready) {
		g.__i18n.dict = await loadDict(g.__i18n.current);
		g.__i18n.ready = true;
		document.documentElement.setAttribute('lang', g.__i18n.current);
	}
	applyTranslations();
}

export function t(key: string, vars?: Record<string, any>): string {
	const val = get(g.__i18n.dict, key);
	const txt = typeof val === 'string' ? val : key;
	return interpolate(txt, vars);
}

export function applyTranslations(root: ParentNode = document) {
	root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
		const key = el.getAttribute('data-i18n')!;
		const txt = t(key);

		const slotNodes = el.querySelectorAll<HTMLElement>('[data-i18n-slot]');
		if (slotNodes.length) {
			const slots = new Map<string, HTMLElement>();
			slotNodes.forEach(node => {
				const n = node.getAttribute('data-i18n-slot')!;
				slots.set(n, node);
			});

			const frag = document.createDocumentFragment();
			const parts = txt.split(/(\{\w+\})/g);

			for (const part of parts) {
				const m = part.match(/^\{(\w+)\}$/);
				if (m) {
					const name = m[1];
					const node = slots.get(name);
					if (node) {
						frag.appendChild(node);
						slots.delete(name);
					} else {
						frag.appendChild(document.createTextNode(''));
					}
				} else if (part) {
					frag.appendChild(document.createTextNode(part));
				}
			}

			el.textContent = '';
			el.appendChild(frag);
			return;
		}
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
			el.placeholder = txt;
		} else {
			el.textContent = txt;
		}
	});
}