# Multi-stage build for serving slothlife as a static SPA.
#
# Stage 1 renders the icon set from assets/favicon.svg so the
# image is fully self-contained — no host prerequisites beyond
# a Docker / Podman runtime. Same render as the deploy-pages
# workflow + the build-android workflow.
#
# Stage 2 is plain nginx-alpine with a small custom server
# block (deploy/nginx.conf) for cache headers + a /healthz
# endpoint the Helm chart's probes can hit.

FROM docker.io/alpine:3.20 AS icons
RUN apk add --no-cache librsvg imagemagick
WORKDIR /icons
COPY assets/favicon.svg /tmp/favicon.svg
RUN set -eux; \
    rsvg-convert -w 192 -h 192 /tmp/favicon.svg -o icon-192.png; \
    rsvg-convert -w 512 -h 512 /tmp/favicon.svg -o icon-512.png; \
    rsvg-convert -w 410 -h 410 /tmp/favicon.svg -o /tmp/_inner.png; \
    magick -size 512x512 xc:'#7A4A28' \
      \( /tmp/_inner.png \) -gravity center -composite \
      icon-mask-512.png; \
    ls -la /icons

FROM docker.io/nginx:1.27-alpine
LABEL org.opencontainers.image.source="https://github.com/blurayne/slothlife"
LABEL org.opencontainers.image.description="A Sloth's Life — windy-tree sloth adventure (static SPA)"
LABEL org.opencontainers.image.licenses="GPL-3.0-or-later"

# Custom server block: cache headers, healthcheck, MIME tweaks.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# Drop nginx's default landing page so a misconfigured root
# can't serve "Welcome to nginx" instead of slothlife.
RUN rm -f /usr/share/nginx/html/index.html

WORKDIR /usr/share/nginx/html
COPY index.html manifest.json sw.js favicon.svg* ./
COPY assets/ ./assets/
COPY --from=icons /icons/ ./icons/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
