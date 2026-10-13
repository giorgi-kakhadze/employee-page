// Pass to the Floor · Gunda · Server Edition: Azure resources.
// NOT VALIDATED: written without access to an Azure subscription or the Bicep compiler. Run `az bicep build` and `az deployment group what-if`
// before deploying, and read docs/DEPLOYMENT-AZURE.md. Everything is private by default: the database and the key vault have no public endpoint.
targetScope = 'resourceGroup'

@description('Short lowercase name used in resource names, e.g. ptf')
param name string = 'ptf'
param location string = resourceGroup().location
@description('The address people will open, e.g. ptf.your-company.com (custom domain is added after deployment)')
param publicHost string
@description('Microsoft Entra tenant id of the company')
param tenantId string = subscription().tenantId
@description('App registration (client) id created for the tool')
param entraClientId string
@description('Company e-mail domains allowed to sign in, comma separated')
param allowedDomains string
@description('Mailbox the tool sends from (Graph Mail.Send, restricted by an Exchange application access policy)')
param mailFrom string
@secure()
param pgAdminPassword string
@description('App Service plan size. P1v3 = 2 vCPU / 8 GB per instance; two instances recommended for 500 simultaneous users.')
param appSku string = 'P1v3'
param instanceCount int = 2
@description('PostgreSQL compute. D4ds_v5 = 4 vCPU / 16 GB.')
param pgSku string = 'Standard_D4ds_v5'

var suffix = uniqueString(resourceGroup().id)
var vnetName = '${name}-vnet-${suffix}'

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${name}-logs-${suffix}'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 90 }
}
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${name}-ai-${suffix}'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logs.id }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: [ '10.40.0.0/16' ] }
    subnets: [
      { name: 'app', properties: { addressPrefix: '10.40.1.0/24', delegations: [ { name: 'web', properties: { serviceName: 'Microsoft.Web/serverFarms' } } ], serviceEndpoints: [ { service: 'Microsoft.Storage' }, { service: 'Microsoft.KeyVault' } ] } }
      { name: 'db', properties: { addressPrefix: '10.40.2.0/24', delegations: [ { name: 'pg', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } } ] } }
    ]
  }
}
resource pgDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${name}${suffix}.private.postgres.database.azure.com'
  location: 'global'
}
resource pgDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: pgDns
  name: 'link'
  location: 'global'
  properties: { virtualNetwork: { id: vnet.id }, registrationEnabled: false }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${name}-pg-${suffix}'
  location: location
  sku: { name: pgSku, tier: 'GeneralPurpose' }
  properties: {
    version: '16'
    administratorLogin: 'ptfadmin'
    administratorLoginPassword: pgAdminPassword
    storage: { storageSizeGB: 128, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 35, geoRedundantBackup: 'Enabled' }
    highAvailability: { mode: 'ZoneRedundant' }
    network: { delegatedSubnetResourceId: '${vnet.id}/subnets/db', privateDnsZoneArmResourceId: pgDns.id, publicNetworkAccess: 'Disabled' }
  }
  dependsOn: [ pgDnsLink ]
}
resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pg
  name: 'ptf'
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${name}kv${suffix}'
  location: location
  properties: {
    tenantId: tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices', virtualNetworkRules: [ { id: '${vnet.id}/subnets/app' } ] }
  }
}

resource sa 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${name}st${suffix}'
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true // App Service Azure Files mounts need the account key; keep it in Key Vault rotation
    networkAcls: { defaultAction: 'Deny', virtualNetworkRules: [ { id: '${vnet.id}/subnets/app' } ] }
  }
}
resource fileSvc 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = { parent: sa, name: 'default' }
resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = { parent: fileSvc, name: 'ptf-files', properties: { shareQuota: 512 } }

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${name}-plan-${suffix}'
  location: location
  kind: 'linux'
  sku: { name: appSku, capacity: instanceCount }
  properties: { reserved: true, zoneRedundant: instanceCount >= 3 }
}
resource app 'Microsoft.Web/sites@2023-01-01' = {
  name: '${name}-app-${suffix}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: '${vnet.id}/subnets/app'
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'node --max-old-space-size=3072 src/server.js'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      alwaysOn: true
      healthCheckPath: '/healthz'
      vnetRouteAllEnabled: true
      ipSecurityRestrictions: [ { name: 'front-door-only', action: 'Allow', priority: 100, ipAddress: 'AzureFrontDoor.Backend', tag: 'ServiceTag', headers: { 'x-azure-fdid': [ frontDoor.properties.frontDoorId ] } } ]
      appSettings: [
        { name: 'PTF_ENV', value: 'production' }
        { name: 'PTF_PUBLIC_URL', value: 'https://${publicHost}' }
        { name: 'PTF_TZ', value: 'Europe/London' }
        { name: 'DATABASE_URL', value: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/database-url/)' }
        { name: 'DATABASE_SSL', value: 'true' }
        { name: 'PTF_SALT', value: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/ptf-salt/)' }
        { name: 'PTF_SESSION_SECRET', value: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/ptf-session-secret/)' }
        { name: 'ENTRA_TENANT_ID', value: tenantId }
        { name: 'ENTRA_CLIENT_ID', value: entraClientId }
        { name: 'ENTRA_CLIENT_SECRET', value: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/entra-client-secret/)' }
        { name: 'PTF_ALLOWED_DOMAINS', value: allowedDomains }
        { name: 'PTF_MAIL', value: 'graph' }
        { name: 'PTF_MAIL_FROM', value: mailFrom }
        { name: 'PTF_TRUST_PROXY', value: 'true' }
        { name: 'PTF_FRONTDOOR_ID', value: frontDoor.properties.frontDoorId }
        { name: 'PTF_DATA_DIR', value: '/mnt/ptf-files' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
      ]
    }
  }
}
resource mount 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: app
  name: 'azurestorageaccounts'
  properties: { files: { type: 'AzureFiles', accountName: sa.name, shareName: share.name, mountPath: '/mnt/ptf-files', accessKey: sa.listKeys().keys[0].value } }
}
// the app's identity may read secrets
resource kvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kv
  name: guid(kv.id, app.id, 'secrets-user')
  properties: { principalId: app.identity.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') }
}

// ---- Front Door (Standard) with a WAF in front of the app ----
resource frontDoor 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: '${name}-fd-${suffix}'
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }   // Premium adds the managed rule sets; Standard works with custom rules only
}
resource waf 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: '${name}waf${suffix}'
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }
  properties: {
    policySettings: { mode: 'Prevention', requestBodyCheck: 'Enabled', enabledState: 'Enabled' }
    managedRules: { managedRuleSets: [ { ruleSetType: 'Microsoft_DefaultRuleSet', ruleSetVersion: '2.1', ruleSetAction: 'Block' }, { ruleSetType: 'Microsoft_BotManagerRuleSet', ruleSetVersion: '1.0' } ] }
    customRules: { rules: [
      { name: 'RateLimitPerIp', priority: 10, ruleType: 'RateLimitRule', action: 'Block', rateLimitDurationInMinutes: 1, rateLimitThreshold: 1200, matchConditions: [ { matchVariable: 'RequestUri', operator: 'Contains', matchValue: [ '/' ] } ] }
      { name: 'AuthRateLimit', priority: 5, ruleType: 'RateLimitRule', action: 'Block', rateLimitDurationInMinutes: 1, rateLimitThreshold: 60, matchConditions: [ { matchVariable: 'RequestUri', operator: 'Contains', matchValue: [ '/auth/' ] } ] }
    ] }
  }
}
resource fdEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = { parent: frontDoor, name: '${name}-${suffix}', location: 'global', properties: { enabledState: 'Enabled' } }
resource fdOrigGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoor
  name: 'app'
  properties: { loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3 }, healthProbeSettings: { probePath: '/healthz', probeRequestType: 'GET', probeProtocol: 'Https', probeIntervalInSeconds: 30 } }
}
resource fdOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: fdOrigGroup
  name: 'appservice'
  properties: { hostName: app.properties.defaultHostName, originHostHeader: app.properties.defaultHostName, httpsPort: 443, priority: 1, weight: 1000, enforceCertificateNameCheck: true }
}
resource fdRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: fdEndpoint
  name: 'all'
  properties: { originGroup: { id: fdOrigGroup.id }, supportedProtocols: [ 'Https' ], httpsRedirect: 'Enabled', forwardingProtocol: 'HttpsOnly', linkToDefaultDomain: 'Enabled', patternsToMatch: [ '/*' ], cacheConfiguration: null }
  dependsOn: [ fdOrigin ]
}
resource fdSecPolicy 'Microsoft.Cdn/profiles/securityPolicies@2023-05-01' = {
  parent: frontDoor
  name: 'waf'
  properties: { parameters: { type: 'WebApplicationFirewall', wafPolicy: { id: waf.id }, associations: [ { domains: [ { id: fdEndpoint.id } ], patternsToMatch: [ '/*' ] } ] } }
}

output appName string = app.name
output frontDoorHost string = fdEndpoint.properties.hostName
output keyVaultName string = kv.name
output postgresHost string = pg.properties.fullyQualifiedDomainName
output appIdentity string = app.identity.principalId
