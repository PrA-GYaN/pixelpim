export enum IntegrationType {
  WOOCOMMERCE = 'woocommerce',
  AMAZON = 'amazon',
  SHOPIFY = 'shopify',
}

export enum IntegrationOperation {
  EXPORT = 'export',
  IMPORT = 'import',
  UPDATE = 'update',
  DELETE = 'delete',
  WEBHOOK = 'webhook',
}

export enum IntegrationStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  PENDING = 'pending',
}
