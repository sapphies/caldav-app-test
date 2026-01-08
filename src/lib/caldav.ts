import { propfind, report, put, del, proppatch, mkcalendar, parseMultiStatus, type CalDAVCredentials } from './tauri-http';
import { Account, Calendar, Task } from '@/types';
import { taskToVTodo, vtodoToTask } from '../utils/ical';
import { createLogger } from './logger';

const log = createLogger('CalDAV', '#3b82f6');

interface AccountConnection {
  serverUrl: string;
  credentials: CalDAVCredentials;
  principalUrl: string;
  calendarHome: string;
  serverType: 'rustical' | 'radicale' | 'baikal' | 'nextcloud' | 'generic';
}

class CalDAVService {
  private connections: Map<string, AccountConnection> = new Map();

  /**
   * connect to a CalDAV account
   * supports multiple server types with different URL structures for the moment:
   * - rustical: {serverUrl}/caldav/principal/{username}/
   * - radicale: {serverUrl}/{username}/
   * - baikal: {serverUrl}/dav.php/principals/{username}/
   * - nextcloud: {serverUrl}/remote.php/dav/principals/users/{username}/
   * - generic: tries .well-known/caldav discovery
   */
  async connect(
    accountId: string,
    serverUrl: string,
    username: string,
    password: string,
    serverType: 'rustical' | 'radicale' | 'baikal' | 'nextcloud' | 'generic' = 'rustical'
  ): Promise<{ principalUrl: string; displayName: string }> {
    const credentials: CalDAVCredentials = { username, password };
    
    // normalize server URL
    const baseUrl = serverUrl.replace(/\/$/, '');
    
    // construct principal URL based on server type
    let principalUrl: string;
    let calendarHome: string;

    switch (serverType) {
      case 'rustical':
        principalUrl = `${baseUrl}/caldav/principal/${username}/`;
        calendarHome = principalUrl;
        break;
      case 'radicale':
        principalUrl = `${baseUrl}/${username}/`;
        calendarHome = principalUrl;
        break;
      case 'baikal':
        principalUrl = `${baseUrl}/dav.php/principals/${username}/`;
        calendarHome = principalUrl;
        break;
      case 'nextcloud':
        principalUrl = `${baseUrl}/remote.php/dav/principals/users/${username}/`;
        calendarHome = `${baseUrl}/remote.php/dav/calendars/${username}/`;
        break;
      case 'generic': {
        // for generic servers, perform proper CalDAV discovery per RFC 4791
        
        // step 1: discover DAV root from .well-known
        const wellKnownUrl = `${baseUrl}/.well-known/caldav`;
        
        const wellKnownResponse = await propfind(wellKnownUrl, credentials, `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`, '0');
        
        // Check for specific HTTP error codes at the well-known endpoint
        if (wellKnownResponse.status === 429) {
          throw new Error('Server reported a 429 error (Rate limit exceeded). Please wait a moment and try again.');
        }
        if (wellKnownResponse.status === 401) {
          throw new Error('Server reportes a 401 error (Authentication failed). Please check your username and password.');
        }
        if (wellKnownResponse.status === 403) {
          throw new Error('Server reported a 403 error (Access forbidden). Please check your credentials and permissions.');
        }
        if (wellKnownResponse.status === 404) {
          throw new Error('Server reported a 404 error (Not Found). The CalDAV service may not be found at this URL. Please check the server URL.');
        }
        if (wellKnownResponse.status >= 500) {
          throw new Error(`Server reported a ${wellKnownResponse.status} error. Please try again later or contact your server administrator.`);
        }
        
        // step 2: discover current-user-principal
        let discoveredPrincipal = await this.discoverPrincipal(wellKnownUrl, credentials);
        
        if (!discoveredPrincipal && wellKnownResponse.status === 207) {
          // if principal not found at well-known, try to extract from response body
          const results = parseMultiStatus(wellKnownResponse.body);
          if (results.length > 0 && results[0].href) {
            // the redirect target might be the DAV root, try discovering principal there
            const davRoot = results[0].href.startsWith('http') 
              ? results[0].href 
              : new URL(results[0].href, baseUrl).toString();
            discoveredPrincipal = await this.discoverPrincipal(davRoot, credentials);
          }
        }
        
        if (!discoveredPrincipal) {
          throw new Error('Failed to discover CalDAV principal. Server may not support auto-discovery.');
        }
        
        // make principal URL absolute
        principalUrl = discoveredPrincipal.startsWith('http') 
          ? discoveredPrincipal 
          : new URL(discoveredPrincipal, baseUrl).toString();
        
        // step 3: discover calendar-home-set from principal
        const discoveredCalendarHome = await this.discoverCalendarHome(principalUrl, credentials);
        
        if (!discoveredCalendarHome) {
          throw new Error('Failed to discover calendar-home-set. Server may not support CalDAV.');
        }
        
        // make calendar home URL absolute
        calendarHome = discoveredCalendarHome.startsWith('http') 
          ? discoveredCalendarHome 
          : new URL(discoveredCalendarHome, baseUrl).toString();
        
        break;
      }
      default:
        throw new Error(`Unknown server type: ${serverType}`);
    }
    
    // verify the connection by doing a PROPFIND on the principal
    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;

    const response = await propfind(principalUrl, credentials, propfindBody, '0');
    
    if (response.status === 401) {
      throw new Error('Authentication failed. Please check your username and password.');
    }
    
    if (response.status !== 207) {
      throw new Error(`Failed to connect: HTTP ${response.status}`);
    }
    
    // parse response to get display name
    const results = parseMultiStatus(response.body);
    const displayName = results[0]?.props['displayname'] || username;
    
    // store the connection
    this.connections.set(accountId, {
      serverUrl: baseUrl,
      credentials,
      principalUrl,
      calendarHome,
      serverType,
    });
    
    return { principalUrl, displayName };
  }

  /**
   * fetch calendars for an account
   */
  async fetchCalendars(accountId: string): Promise<Calendar[]> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    // PROPFIND on calendar home to get calendars
    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <c:supported-calendar-component-set/>
    <d:getctag/>
    <d:sync-token/>
    <a:calendar-color/>
  </d:prop>
</d:propfind>`;

    const response = await propfind(conn.calendarHome, conn.credentials, propfindBody, '1');
    
    if (response.status !== 207) {
      throw new Error(`Failed to fetch calendars: HTTP ${response.status}`);
    }
    
    const results = parseMultiStatus(response.body);
    
    const calendars: Calendar[] = [];
    
    // extract the path from calendar home for comparison
    const calendarHomePath = new URL(conn.calendarHome, conn.serverUrl).pathname;
    
    for (const result of results) {
      
      // skip the calendar home itself (exact match only)
      const resultPath = result.href.startsWith('http') 
        ? new URL(result.href).pathname 
        : result.href;
      
      if (resultPath === calendarHomePath || resultPath === calendarHomePath.replace(/\/$/, '')) {
        continue;
      }
      
      // check if it's a calendar (must have 'calendar' in resourcetype)
      const resourceType = result.props['resourcetype'] || '';
      if (!resourceType.includes('calendar')) {
        continue;
      }
      
      // parse supported-calendar-component-set to determine if this calendar supports VTODO
      const supportedComponentsRaw = result.props['supported-calendar-component-set'] || '';
      const supportedComponents: string[] = [];
      const componentMatches = supportedComponentsRaw.matchAll(/<[^:>]*:?comp[^>]+name="([^"]+)"/gi);
      for (const match of componentMatches) {
        supportedComponents.push(match[1]);
      }
      
      // only include calendars that support VTODO (for task management)
      if (supportedComponents.length > 0 && !supportedComponents.includes('VTODO')) {
        continue;
      }
      
      // build absolute URL
      let calendarUrl = result.href;
      if (!calendarUrl.startsWith('http')) {
        calendarUrl = new URL(result.href, conn.serverUrl).toString();
      }
      
      calendars.push({
        id: calendarUrl,
        displayName: result.props['displayname'] || 'Calendar',
        url: calendarUrl,
        ctag: result.props['getctag'] || undefined,
        syncToken: result.props['sync-token'] || undefined,
        color: result.props['calendar-color'] || undefined,
        accountId,
        supportedComponents: supportedComponents.length > 0 ? supportedComponents : undefined,
      });
    }
    
    return calendars;
  }

  /**
   * fetch tasks from a calendar
   */
  async fetchTasks(accountId: string, calendar: Calendar): Promise<Task[]> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    // use calendar-query REPORT to fetch VTODOs
    const reportBody = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VTODO"/>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    const response = await report(calendar.url, conn.credentials, reportBody, '1');
    
    if (response.status !== 207) {
      log.error(`Failed to fetch tasks: HTTP ${response.status}`);
      log.error(`Response body:`, response.body);
      return [];
    }
    
    const results = parseMultiStatus(response.body);
    const tasks: Task[] = [];
    
    for (const result of results) {
      const calendarData = result.props['calendar-data'];
      const etag = result.props['getetag']?.replace(/"/g, '');
      
      if (calendarData) {
        // build absolute URL
        let href = result.href;
        if (!href.startsWith('http')) {
          href = new URL(result.href, conn.serverUrl).toString();
        }
        
        const task = vtodoToTask(calendarData, accountId, calendar.id, href, etag || undefined);
        if (task) {
          tasks.push(task);
        }
      }
    }
    
    return tasks;
  }

  async createTask(
    accountId: string,
    calendar: Calendar,
    task: Task
  ): Promise<{ href: string; etag: string } | null> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    try {
      const icalData = taskToVTodo(task);
      const filename = `${task.uid}.ics`;
      const url = `${calendar.url.replace(/\/$/, '')}/${filename}`;

      const response = await put(url, conn.credentials, icalData);

      if (response.status === 201 || response.status === 204) {
        const etag = response.headers['etag']?.replace(/"/g, '') || '';
        return { href: url, etag };
      }
      
      log.error(`Failed to create task: HTTP ${response.status}`);
      return null;
    } catch (error) {
      log.error('Error creating task:', error);
      return null;
    }
  }

  async updateTask(accountId: string, task: Task): Promise<{ etag: string } | null> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    if (!task.href) {
      log.error('Task has no href for update');
      return null;
    }

    try {
      const icalData = taskToVTodo(task);
      const response = await put(task.href, conn.credentials, icalData, task.etag);

      if (response.status === 200 || response.status === 201 || response.status === 204) {
        const etag = response.headers['etag']?.replace(/"/g, '') || '';
        return { etag };
      }
      
      log.error(`Failed to update task: HTTP ${response.status}`);
      return null;
    } catch (error) {
      log.error('Error updating task:', error);
      return null;
    }
  }


  async deleteTask(accountId: string, task: Task): Promise<boolean> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    if (!task.href) {
      log.error('Task has no href for deletion');
      return false;
    }

    try {
      const response = await del(task.href, conn.credentials, task.etag);
      return response.status === 204 || response.status === 200;
    } catch (error) {
      log.error('Error deleting task:', error);
      return false;
    }
  }

  async syncCalendar(
    accountId: string,
    calendar: Calendar,
    localTasks: Task[]
  ): Promise<{
    created: Task[];
    updated: Task[];
    deleted: string[];
  }> {
    const remoteTasks = await this.fetchTasks(accountId, calendar);
    
    const created: Task[] = [];
    const updated: Task[] = [];
    const deleted: string[] = [];

    // find new and updated tasks from server
    for (const remoteTask of remoteTasks) {
      const localTask = localTasks.find((t) => t.uid === remoteTask.uid);
      
      if (!localTask) {
        created.push(remoteTask);
      } else if (remoteTask.etag !== localTask.etag) {
        // ETag changed means server has a newer version
        updated.push({ ...remoteTask, id: localTask.id });
      }
    }

    // find deleted tasks (tasks that exist locally but not on server)
    const remoteUids = new Set(remoteTasks.map((t) => t.uid));
    for (const localTask of localTasks) {
      if (localTask.synced && !remoteUids.has(localTask.uid)) {
        deleted.push(localTask.id);
      }
    }

    return { created, updated, deleted };
  }

  /**
   * update calendar properties (displayname, color)
   * sends separate PROPPATCH requests for each property
   * to maximize compatibility with different CalDAV servers
   */
  async updateCalendar(
    accountId: string,
    calendarUrl: string,
    updates: { displayName?: string; color?: string }
  ): Promise<{ success: boolean; failedProperties: string[] }> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    const failedProperties: string[] = [];

    // update displayname in a separate PROPPATCH request
    if (updates.displayName) {
      const displaynameBody = `<?xml version="1.0" encoding="utf-8"?>
<propertyupdate xmlns="DAV:">
    <set>
        <prop>
            <displayname>${updates.displayName}</displayname>
        </prop>
    </set>
</propertyupdate>`;

      const response = await proppatch(calendarUrl, conn.credentials, displaynameBody);
      
      if (response.status !== 207 && response.status !== 200) {
        log.error(`Failed to update displayname: HTTP ${response.status}`);
        failedProperties.push('displayname');
      } else {
        // check if displayname update succeeded in the multistatus response
        const displaynameSucceeded = this.checkPropertySuccess(response.body, 'displayname');
        if (!displaynameSucceeded) {
          failedProperties.push('displayname');
        }
      }
    }
    
    // update color in a separate PROPPATCH request
    if (updates.color) {
      // ensure color has alpha channel for better server compatibility
      const colorWithAlpha = updates.color.length === 7 
        ? `${updates.color}FF` 
        : updates.color;
      
      const colorBody = `<?xml version="1.0" encoding="utf-8"?>
<propertyupdate xmlns="DAV:">
    <set>
        <prop>
            <calendar-color xmlns="http://apple.com/ns/ical/">${colorWithAlpha}</calendar-color>
        </prop>
    </set>
</propertyupdate>`;

      const response = await proppatch(calendarUrl, conn.credentials, colorBody);
      
      if (response.status !== 207 && response.status !== 200) {
        log.error(`Failed to update color: HTTP ${response.status}`);
        failedProperties.push('calendar-color');
      } else {
        // check if color update succeeded in the multistatus response
        const colorSucceeded = this.checkPropertySuccess(response.body, 'calendar-color');
        if (!colorSucceeded) {
          failedProperties.push('calendar-color');
        }
      }
    }

    return { success: failedProperties.length === 0, failedProperties };
  }

  /**
   * discover current-user-principal from DAV root
   */
  private async discoverPrincipal(
    davRootUrl: string,
    credentials: CalDAVCredentials
  ): Promise<string | null> {
    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`;

    const response = await propfind(davRootUrl, credentials, propfindBody, '0');

    // Check for specific HTTP error codes and throw meaningful errors
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 401) {
      throw new Error('Authentication failed. Please check your username and password.');
    }
    if (response.status === 403) {
      throw new Error('Access forbidden. Please check your credentials and permissions.');
    }
    if (response.status === 404) {
      throw new Error('CalDAV service not found at this URL. Please check the server URL.');
    }
    if (response.status >= 500) {
      throw new Error(`Server error (${response.status}). Please try again later or contact your server administrator.`);
    }
    if (response.status !== 207) {
      return null;
    }

    const results = parseMultiStatus(response.body);
    if (results.length === 0) {
      return null;
    }

    // extract current-user-principal href (handle namespace prefixes like d:current-user-principal)
    const match = response.body.match(/<[^:>]*:?current-user-principal[^>]*>\s*<[^:>]*:?href[^>]*>([^<]+)<\/[^:>]*:?href>/i);
    if (match) {
      return match[1];
    }

    return null;
  }

  /**
   * discover calendar-home-set from principal URL
   */
  private async discoverCalendarHome(
    principalUrl: string,
    credentials: CalDAVCredentials
  ): Promise<string | null> {
    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`;

    const response = await propfind(principalUrl, credentials, propfindBody, '0');

    // Check for specific HTTP error codes and throw meaningful errors
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 401) {
      throw new Error('Authentication failed. Please check your username and password.');
    }
    if (response.status === 403) {
      throw new Error('Access forbidden. Please check your credentials and permissions.');
    }
    if (response.status === 404) {
      throw new Error('CalDAV principal not found. Please check the server URL.');
    }
    if (response.status >= 500) {
      throw new Error(`Server error (${response.status}). Please try again later or contact your server administrator.`);
    }
    if (response.status !== 207) {
      return null;
    }

    // extract calendar-home-set href (handle namespace prefixes like c:calendar-home-set, cal:calendar-home-set, etc.)
    const match = response.body.match(/<[^:>]*:?calendar-home-set[^>]*>\s*<[^:>]*:?href[^>]*>([^<]+)<\/[^:>]*:?href>/i);
    if (match) {
      return match[1];
    }

    return null;
  }

  /**
   * check if a property update succeeded in a PROPPATCH multistatus response
   */
  private checkPropertySuccess(responseBody: string, propertyName: string): boolean {
    // parse the multistatus response to check if the property is in a 200 OK propstat
    const propstatMatches = responseBody.matchAll(/<propstat>([\s\S]*?)<\/propstat>/gi);
    
    for (const match of propstatMatches) {
      const propstat = match[1];
      const statusMatch = propstat.match(/<status>HTTP\/[\d.]+ (\d+)/i);
      const status = statusMatch ? parseInt(statusMatch[1]) : 0;
      
      // check if this propstat contains our property
      if (propstat.toLowerCase().includes(propertyName.toLowerCase())) {
        return status === 200;
      }
    }
    
    // property not found in response - assume failure
    return false;
  }

  /**
   * delete a calendar from the server
   */
  async deleteCalendar(accountId: string, calendarUrl: string): Promise<boolean> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    try {
      const response = await del(calendarUrl, conn.credentials);
      
      if (response.status !== 204 && response.status !== 200) {
        log.error(`Failed to delete calendar: HTTP ${response.status}`);
        throw new Error(`Failed to delete calendar: HTTP ${response.status}`);
      }

      return true;
    } catch (error) {
      log.error('Error deleting calendar:', error);
      throw error;
    }
  }

  /**
   * create a new calendar collection on the server
   */
  async createCalendar(
    accountId: string,
    displayName: string,
    color?: string
  ): Promise<Calendar> {
    const conn = this.connections.get(accountId);
    if (!conn) throw new Error('Account not connected');

    // generate a URL-safe name for the calendar
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'calendar';
    
    // create the calendar URL under the calendar home
    const calendarUrl = `${conn.calendarHome}${slug}/`;
    
    // build the MKCALENDAR request body
    let colorProp = '';
    if (color) {
      colorProp = `<a:calendar-color xmlns:a="http://apple.com/ns/ical/">${color}</a:calendar-color>`;
    }

    const mkcalendarBody = `<?xml version="1.0" encoding="utf-8"?>
<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:set>
    <d:prop>
      <d:displayname>${displayName}</d:displayname>
      <c:supported-calendar-component-set>
        <c:comp name="VTODO"/>
      </c:supported-calendar-component-set>
      ${colorProp}
    </d:prop>
  </d:set>
</c:mkcalendar>`;

    const response = await mkcalendar(calendarUrl, conn.credentials, mkcalendarBody);
    
    if (response.status !== 201 && response.status !== 200) {
      log.error(`Failed to create calendar: HTTP ${response.status}`, response.body);
      throw new Error(`Failed to create calendar: HTTP ${response.status}`);
    }

    log.info(`Calendar created successfully`);

    // return the new calendar object
    return {
      id: calendarUrl,
      displayName,
      url: calendarUrl,
      color,
      accountId,
      supportedComponents: ['VTODO'],
    };
  }

  /**
   * disconnect an account
   */
  disconnect(accountId: string): void {
    this.connections.delete(accountId);
  }

  /**
   * check if an account is connected
   */
  isConnected(accountId: string): boolean {
    return this.connections.has(accountId);
  }

  /**
   * reconnect an account using stored credentials
   */
  async reconnect(account: Account): Promise<void> {
    if (!account.serverUrl || !account.username || !account.password) {
      throw new Error('Missing account credentials');
    }
    
    await this.connect(
      account.id, 
      account.serverUrl, 
      account.username, 
      account.password,
      account.serverType || 'rustical'
    );
  }
}

export const caldavService = new CalDAVService();
