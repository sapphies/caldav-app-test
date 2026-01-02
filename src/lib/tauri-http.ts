import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface CalDAVCredentials {
  username: string;
  password: string;
  /** OAuth Bearer token - if provided, uses Bearer auth instead of Basic */
  bearerToken?: string;
}

export async function tauriRequest(
  url: string,
  method: string,
  credentials: CalDAVCredentials,
  body?: string,
  headers?: Record<string, string>
): Promise<HttpResponse> {
  console.log(`[HTTP] ${method} ${url}`);
  
  // use bearer token if provided, otherwise fall back to Basic auth
  const authHeader = credentials.bearerToken
    ? `Bearer ${credentials.bearerToken}`
    : `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
  
  const requestHeaders: Record<string, string> = {
    'Authorization': authHeader,
    'Content-Type': 'application/xml; charset=utf-8',
    ...headers,
  };
  
  const response = await tauriFetch(url, {
    method: method,
    headers: requestHeaders,
    body: body,
  });
  
  console.log(`[HTTP] Response: ${response.status}`);
  
  // handle redirects manually for CalDAV
  if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
    const location = response.headers.get('location') || response.headers.get('Location');
    if (location) {
      // resolve relative URLs
      const redirectUrl = new URL(location, url).toString();
      return tauriRequest(redirectUrl, method, credentials, body, headers);
    }
  }
  
  // convert response text
  const responseBody = await response.text();
  
  // convert Headers to plain object
  const headersObj: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  
  return {
    status: response.status,
    headers: headersObj,
    body: responseBody,
  };
}

/**
 * PROPFIND request for CalDAV discovery and listing
 */
export async function propfind(
  url: string,
  credentials: CalDAVCredentials,
  body: string,
  depth: '0' | '1' | 'infinity' = '1'
): Promise<HttpResponse> {
  return tauriRequest(url, 'PROPFIND', credentials, body, {
    'Depth': depth,
    'Content-Type': 'application/xml; charset=utf-8',
  });
}

/**
 * REPORT request for CalDAV queries (fetching tasks with filters)
 */
export async function report(
  url: string,
  credentials: CalDAVCredentials,
  body: string,
  depth: '0' | '1' = '1'
): Promise<HttpResponse> {
  return tauriRequest(url, 'REPORT', credentials, body, {
    'Depth': depth,
    'Content-Type': 'application/xml; charset=utf-8',
  });
}

/**
 * PROPPATCH request for updating properties
 */
export async function proppatch(
  url: string,
  credentials: CalDAVCredentials,
  body: string
): Promise<HttpResponse> {
  return tauriRequest(url, 'PROPPATCH', credentials, body, {
    'Content-Type': 'application/xml; charset=utf-8',
  });
}

/**
 * PUT request for creating/updating calendar objects
 */
export async function put(
  url: string,
  credentials: CalDAVCredentials,
  body: string,
  etag?: string
): Promise<HttpResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/calendar; charset=utf-8',
  };
  
  if (etag) {
    // ETags must be quoted in If-Match header per RFC 2616
    headers['If-Match'] = `"${etag}"`;
  } else {
    headers['If-None-Match'] = '*';
  }
  
  return tauriRequest(url, 'PUT', credentials, body, headers);
}

/**
 * DELETE request for removing calendar objects
 */
export async function del(
  url: string,
  credentials: CalDAVCredentials,
  etag?: string
): Promise<HttpResponse> {
  const headers: Record<string, string> = {};
  
  if (etag) {
    // ETags must be quoted in If-Match header per RFC 2616
    headers['If-Match'] = `"${etag}"`;
  }
  
  return tauriRequest(url, 'DELETE', credentials, undefined, headers);
}

/**
 * MKCALENDAR request for creating a new calendar collection
 */
export async function mkcalendar(
  url: string,
  credentials: CalDAVCredentials,
  body: string
): Promise<HttpResponse> {
  return tauriRequest(url, 'MKCALENDAR', credentials, body);
}

/**
 * parse multistatus XML response
 */
export function parseMultiStatus(xml: string): MultiStatusResponse[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  
  const responses: MultiStatusResponse[] = [];
  const responseElements = doc.querySelectorAll('response');
  
  for (const resp of responseElements) {
    const href = resp.querySelector('href')?.textContent || '';
    const status = resp.querySelector('status')?.textContent || '';
    const propstat = resp.querySelector('propstat');
    
    const props: Record<string, string | null> = {};
    
    if (propstat) {
      const prop = propstat.querySelector('prop');
      if (prop) {
        for (const child of prop.children) {
          // handle namespaced element names
          const localName = child.localName;
          
          // special handling for resourcetype - check for child elements
          if (localName === 'resourcetype') {
            // get all child element names (like "calendar", "collection", "principal")
            const childNames = Array.from(child.children).map(c => c.localName);
            props[localName] = childNames.join(',');
          } else if (localName === 'current-user-principal' || localName === 'calendar-home-set') {
            // these properties contain an <href> child element
            const hrefElement = child.querySelector('href');
            props[localName] = hrefElement?.textContent || null;
          } else if (child.children.length > 0) {
            // for other elements with children, get innerHTML to preserve structure
            props[localName] = child.innerHTML;
          } else {
            props[localName] = child.textContent;
          }
        }
      }
    }
    
    responses.push({ href, status, props });
  }
  
  return responses;
}

export interface MultiStatusResponse {
  href: string;
  status: string;
  props: Record<string, string | null>;
}
