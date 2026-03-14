#!/bin/sh
# docker/entrypoint.sh (share with DevOps)
# Generate manifest from environment variables injected by ECS/EKS
cat > /usr/share/nginx/html/module-federation.manifest.json << EOF
{
  "mfe_products": "${MFE_PRODUCTS_URL}/mf-manifest.json",
  "mfe_orders": "${MFE_ORDERS_URL}/mf-manifest.json",
  "mfe_account": "${MFE_ACCOUNT_URL}/mf-manifest.json"
}
EOF

exec nginx -g "daemon off;"
