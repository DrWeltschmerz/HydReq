# Docker

HydReq provides an official lightweight Docker image for easy deployment, local testing, and CI/CD integration.

## Quick Start

### Run the Web UI

Start the web interface on port 8787:

```bash
docker run -p 8787:8787 ghcr.io/drweltschmerz/hydreq:latest
```

Then open http://localhost:8787 in your browser.

### Run Tests via CLI

Run a single test suite:

```bash
docker run -v $(pwd)/testdata:/testdata \
  ghcr.io/drweltschmerz/hydreq:latest \
  run -f /testdata/example.hrq.yaml -v
```

Run all test suites in a directory:

```bash
docker run -v $(pwd)/testdata:/testdata \
           -v $(pwd)/reports:/reports \
  ghcr.io/drweltschmerz/hydreq:latest \
  run --workers 4 --report-dir /reports
```

## Image Details

- **Registry:** GitHub Container Registry (ghcr.io)
- **Base Image:** Alpine Linux 3.21
- **Size:** ~30MB compressed
- **Architectures:** linux/amd64, linux/arm64
- **User:** Runs as non-root user `hydreq` (UID 1000, GID 1000)
- **Exposed Port:** 8787 (Web UI)

## Available Tags

- `latest` — Latest stable release from main branch
- `main` — Latest development build from main branch
- `v1.2.3` — Specific version (semantic versioning)
- `v1.2` — Latest patch for minor version
- `v1` — Latest minor version for major version

## Configuration

### Environment Variables

Pass environment variables to your tests:

```bash
docker run -p 8787:8787 \
  -e HTTPBIN_BASE_URL=https://api.example.com \
  -e DEMO_BEARER=your-api-token \
  -e API_KEY=secret123 \
  ghcr.io/drweltschmerz/hydreq:latest
```

### Volume Mounts

Mount test suites and collect reports:

```bash
docker run \
  -v $(pwd)/testdata:/testdata:ro \
  -v $(pwd)/reports:/reports \
  ghcr.io/drweltschmerz/hydreq:latest \
  run -f /testdata/my-suite.hrq.yaml --report-dir /reports
```

**Common mount points:**
- `/testdata` — Test suite files
- `/reports` — Generated reports (JSON, JUnit, HTML)
- `/app` — Application directory (contains hydreq binary)

### Custom Entrypoint

Override the entrypoint for advanced usage:

```bash
# Run with shell access
docker run -it --entrypoint /bin/sh \
  ghcr.io/drweltschmerz/hydreq:latest

# Run different commands
docker run ghcr.io/drweltschmerz/hydreq:latest --help
docker run ghcr.io/drweltschmerz/hydreq:latest import postman --help
```

## Docker Compose

Example `docker-compose.yml` for local development:

```yaml
version: '3.8'

services:
  hydreq:
    image: ghcr.io/drweltschmerz/hydreq:latest
    ports:
      - "8787:8787"
    volumes:
      - ./testdata:/testdata:ro
      - ./reports:/reports
    environment:
      - HTTPBIN_BASE_URL=http://httpbin:80
      - DEMO_BEARER=demo-token
    depends_on:
      - httpbin

  httpbin:
    image: kennethreitz/httpbin
    ports:
      - "8080:80"
```

Start with:

```bash
docker-compose up
```

## CI/CD Integration

### GitHub Actions

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run HydReq tests
        run: |
          docker run -v $(pwd)/testdata:/testdata \
                     -v $(pwd)/reports:/reports \
            ghcr.io/drweltschmerz/hydreq:latest \
            run --workers 4 --report-dir /reports
      
      - name: Upload reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-reports
          path: reports/
```

### GitLab CI

```yaml
api-tests:
  image: ghcr.io/drweltschmerz/hydreq:latest
  script:
    - hydreq run --workers 4 --report-dir reports
  artifacts:
    when: always
    paths:
      - reports/
    reports:
      junit: reports/*.xml
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('API Tests') {
            steps {
                script {
                    docker.image('ghcr.io/drweltschmerz/hydreq:latest').inside {
                        sh 'hydreq run --workers 4 --report-dir reports'
                    }
                }
            }
        }
    }
    post {
        always {
            junit 'reports/*.xml'
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
        }
    }
}
```

## Building Locally

To build the Docker image locally:

```bash
# Build for your current platform
docker build -t hydreq:local .

# Build for multiple platforms (requires buildx)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t hydreq:local \
  --load \
  .
```

## Troubleshooting

### Permission Issues

If you encounter permission errors with volume mounts, ensure the files are readable by UID 1000:

```bash
# Make testdata readable
chmod -R a+r testdata/

# Make reports directory writable
mkdir -p reports && chmod a+w reports/
```

Alternatively, run as root (not recommended):

```bash
docker run --user root \
  -v $(pwd)/testdata:/testdata \
  ghcr.io/drweltschmerz/hydreq:latest \
  run -f /testdata/example.hrq.yaml
```

### Network Issues

If tests can't reach external services, ensure proper network configuration:

```bash
# Use host network (Linux only)
docker run --network host \
  ghcr.io/drweltschmerz/hydreq:latest \
  run -f /testdata/example.hrq.yaml
```

### Viewing Logs

Run with verbose output:

```bash
docker run ghcr.io/drweltschmerz/hydreq:latest \
  run -f /testdata/example.hrq.yaml -v
```

Get container logs:

```bash
docker logs <container-id>
```

## Security

- Image runs as non-root user (UID 1000)
- Minimal attack surface with Alpine base
- No unnecessary tools or packages
- CA certificates included for HTTPS
- Regular security updates via automated builds

## Support

- **Issues:** https://github.com/DrWeltschmerz/HydReq/issues
- **Documentation:** https://github.com/DrWeltschmerz/HydReq/tree/main/docs
- **Registry:** https://github.com/DrWeltschmerz/HydReq/pkgs/container/hydreq
