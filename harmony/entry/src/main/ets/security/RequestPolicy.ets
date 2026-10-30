import { resourceManager } from '@kit.LocalizationKit';
import { url, util } from '@kit.ArkTS';

interface Route { origin: string; method: string; path: string; }
interface MediaRoute { origin: string; pathPrefix: string; }
interface PolicyData {
  version: number;
  routes: Route[];
  skbirdRoutes: Route[];
  mediaRoutes: MediaRoute[];
  appIds: string[];
}

export class RequestPolicy {
  private data: PolicyData;

  constructor(manager: resourceManager.ResourceManager) {
    const bytes = manager.getRawFileContentSync('security-policy.json');
    this.data = JSON.parse(util.TextDecoder.create('utf-8').decodeToString(bytes)) as PolicyData;
    if (this.data.version !== 1) throw new Error('Invalid request policy');
  }

  validate(method: string, input: string, body: string = '', depth: number = 0): void {
    if (depth > 3 || input.length > 8192) throw new Error('Request rejected');
    const parsed = new url.URL(input);
    if (parsed.username || parsed.password || parsed.port || /[%\\]/.test(parsed.pathname)) {
      throw new Error('Request rejected');
    }
    const schoolOrigin = /^(https:\/\/(cer|jwxt|epay|ehall|ldxt|xgxt)\.ysu\.edu\.cn|http:\/\/(202\.206\.247\.49|xgxt\.ysu\.edu\.cn))$/.test(parsed.origin);
    if (depth > 0 && !schoolOrigin) throw new Error('Callback rejected');
    const roleChange = method === 'POST' && parsed.origin === 'https://xgxt.ysu.edu.cn' &&
      /^\/xsfw\/sys\/funauthapp\/api\/changeAppRole\/zhcptybbapp\/[A-Za-z0-9_-]+\.do$/.test(parsed.pathname);
    const allowed = roleChange || this.data.routes.concat(this.data.skbirdRoutes).some((route: Route) =>
      route.origin === parsed.origin && route.method === method && route.path === parsed.pathname) ||
      (method === 'GET' && this.data.mediaRoutes.some((route: MediaRoute) =>
        route.origin === parsed.origin && parsed.pathname.startsWith(route.pathPrefix)));
    if (!allowed) throw new Error('Request rejected');
    if (parsed.pathname === '/jwapp/sys/emaphome/appShow.do' &&
      !this.data.appIds.includes(parsed.params.get('id') ?? '')) {
      throw new Error('Request rejected');
    }
    const sources: url.URLParams[] = [parsed.params, new url.URLParams(body)];
    sources.forEach((params: url.URLParams) => {
      ['service', 'success'].forEach((key: string) => {
        const values = params.getAll(key);
        if (values.length > 1) throw new Error('Duplicate callback rejected');
        const target = values[0];
        if (target) this.validate('GET', target, '', depth + 1);
      });
    });
  }
}
