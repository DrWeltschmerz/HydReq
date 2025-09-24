# Adapter Specifications Research

This document contains research on the specifications and supported features for each import adapter format in HydReq.

## Postman Collection v2.1

**Source:** https://schema.postman.com/collection/json/v2.1.0/collection.json (schema), https://learning.postman.com/docs/sending-requests/authorization/ (docs)

**Format:** JSON

**Key Features:**
- **Auth Methods:** API Key, Bearer Token, Basic Auth, Digest Auth, OAuth 1.0, OAuth 2.0 (authorization_code, implicit, password, client_credentials), Hawk, AWS Signature, NTLM
- **Environment Variables:** Collections can have variables, environments are separate JSON files with variable arrays
- **Pre/Post Scripts:** JavaScript code in `event` arrays with `listen: "prerequest"` or `listen: "test"`
- **Request Bodies:** raw (text/json/xml), form-data (multipart), urlencoded, binary, GraphQL
- **Headers:** Key-value pairs
- **Query Parameters:** Key-value pairs
- **Folders:** Items can be nested folders containing requests and subfolders
- **Security Schemes:** Various auth types as above

**Structure:**
```json
{
  "info": { "name": "...", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  "item": [
    {
      "name": "Request/Folder",
      "request": { "method": "GET", "url": "...", "auth": {...}, "body": {...}, "header": [...] },
      "event": [{ "listen": "prerequest", "script": { "exec": ["javascript code"] } }],
      "item": [...] // nested items
    }
  ],
  "variable": [...]
}
```

## Insomnia v5 Export

**Source:** https://github.com/Kong/insomnia (open source repo), export format in code

**Format:** YAML (collection.insomnia.rest/5.0)

**Key Features:**
- **Auth Methods:** Basic, Bearer, Digest, OAuth2, AWS v4, NTLM, API Key, Hawk, Edgegrid, ASAP, Netrc
- **Environment Variables:** Separate environment resources with data objects
- **Pre/Post Scripts:** preRequestScript, afterResponseScript (JavaScript)
- **Request Bodies:** json, text, xml, form-urlencoded, multipart, file, graphql
- **Headers:** Arrays of key-value objects
- **Query Parameters:** URL parameters
- **Folders:** Request groups with nested children
- **Security Schemes:** Various auth types as above

**Structure:**
```yaml
type: collection.insomnia.rest/5.0
name: Collection Name
meta:
  id: ...
  created: ...
  modified: ...
collection:
  - name: Request Name
    request:
      method: GET
      url: https://api.example.com
      authentication: { type: basic, ... }
      headers: [{ name: ..., value: ... }]
      body: { mimeType: application/json, text: '{"key": "value"}' }
    scripts:
      preRequest: javascript code
      afterResponse: javascript code
  - name: Folder Name
    children: [...]
environments:
  - name: Environment Name
    data: { var1: value1, var2: value2 }
```

## HAR (HTTP Archive) v1.2

**Source:** https://w3c.github.io/web-performance/snapshot/contexts/har.html (W3C standard)

**Format:** JSON

**Key Features:**
- **Auth Methods:** Not directly supported (may be in headers/cookies)
- **Environment Variables:** Not supported
- **Pre/Post Scripts:** Not supported
- **Request Bodies:** Raw text/binary, with mimeType
- **Headers:** Arrays of name-value pairs
- **Query Parameters:** In URL or separate
- **Folders:** Not supported (flat list of entries)
- **Security Schemes:** Not applicable

**Structure:**
```json
{
  "log": {
    "entries": [
      {
        "request": {
          "method": "GET",
          "url": "https://api.example.com",
          "headers": [{ "name": "...", "value": "..." }],
          "postData": { "mimeType": "application/json", "text": "..." }
        },
        "response": { ... }
      }
    ]
  }
}
```

## OpenAPI v3.0+ / Swagger v2.0

**Source:** https://swagger.io/specification/ (OAI standard)

**Format:** JSON/YAML

**Key Features:**
- **Auth Methods:** Security schemes (apiKey, http basic/bearer/digest, oauth2, openIdConnect)
- **Environment Variables:** Not directly supported (servers with variables)
- **Pre/Post Scripts:** Not supported
- **Request Bodies:** Defined in requestBody with content types
- **Headers:** In parameters or headers
- **Query Parameters:** In parameters
- **Folders:** Paths can be organized logically
- **Security Schemes:** Comprehensive security definitions

**OpenAPI 3.0+ Structure:**
```yaml
openapi: 3.0.0
info: { title: API Title, version: 1.0.0 }
servers: [{ url: https://api.example.com }]
security: [{ apiKey: [] }]
paths:
  /users:
    get:
      parameters: [{ name: param, in: query, schema: { type: string } }]
      security: [{ apiKey: [] }]
```

**Swagger 2.0 Structure:**
```yaml
swagger: "2.0"
info: { title: API Title, version: 1.0.0 }
host: api.example.com
basePath: /
schemes: [https]
securityDefinitions:
  apiKey: { type: apiKey, in: header, name: X-API-Key }
security: [{ apiKey: [] }]
paths:
  /users:
    get:
      parameters: [{ name: param, in: query, type: string }]
      security: [{ apiKey: [] }]
```

## Bruno Collection

**Source:** https://github.com/usebruno/bruno (open source repo)

**Format:** Custom .bru text format, JSON export

**Key Features:**
- **Auth Methods:** Basic, Bearer, Digest, NTLM, OAuth2, AWS v4, WSSE, API Key
- **Environment Variables:** Separate .bru files in environments/ folder, or embedded in JSON exports
- **Pre/Post Scripts:** script:pre-request, script:post-response (JavaScript)
- **Request Bodies:** json, text, xml, form-urlencoded, multipart, file, graphql
- **Headers:** Key-value pairs
- **Query Parameters:** URL params
- **Folders:** folder.bru files with nested structure
- **Security Schemes:** Various auth types as above

**Structure (.bru format):**
```
meta {
  name: Request Name
}

get {
  https://api.example.com/users
}

auth:basic {
  username: user
  password: pass
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "key": "value"
  }
}

script:pre-request {
  // javascript
}

vars:request {
  userId: 123
}
```

**JSON Export:**
```json
{
  "name": "Collection Name",
  "items": [
    {
      "name": "Request Name",
      "request": {
        "method": "GET",
        "url": "https://api.example.com",
        "auth": { "mode": "basic", "basic": { "username": "user", "password": "pass" } },
        "headers": [{ "name": "Content-Type", "value": "application/json" }],
        "body": { "mode": "json", "json": "{\"key\": \"value\"}" },
        "script": { "req": "// javascript" },
        "vars": { "req": [{ "name": "userId", "value": "123" }] }
      }
    }
  ],
  "environments": [
    {
      "name": "Dev",
      "variables": [{ "name": "baseUrl", "value": "https://dev.api.com" }]
    }
  ]
}
```

## Summary of Feature Coverage

| Feature | Postman | Insomnia | HAR | OpenAPI | Bruno |
|---------|---------|----------|-----|---------|-------|
| Auth Methods | ✅ Full | ✅ Full | ❌ None | ✅ Schemes | ✅ Full |
| Environments | ✅ Separate | ✅ Included | ❌ None | ❌ Servers | ✅ Separate |
| Pre Scripts | ✅ JS | ✅ JS | ❌ None | ❌ None | ✅ JS |
| Post Scripts | ✅ JS | ✅ JS | ❌ None | ❌ None | ✅ JS |
| Bodies | ✅ Full | ✅ Full | ✅ Basic | ✅ Schemas | ✅ Full |
| Headers | ✅ | ✅ | ✅ | ✅ | ✅ |
| Query Params | ✅ | ✅ | ✅ | ✅ | ✅ |
| Folders | ✅ Nested | ✅ Groups | ❌ Flat | ❌ Paths | ✅ Nested |

This research provides the foundation for implementing comprehensive import adapters that can convert all supported features to HydReq's Suite/TestCase structure.