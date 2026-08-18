import { rootCertificates, X509Certificate } from "node:tls";

/**
 * family.by currently serves an incomplete AlphaSSL/GlobalSign chain. Browsers
 * can often recover the missing intermediate automatically; Node/OpenSSL does
 * not, and rejects the connection with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 *
 * These are the two current AlphaSSL RSA intermediates published by GlobalSign
 * for the 2025/2026 transition. They are public CA certificates, not private
 * material. TLS verification and hostname verification remain enabled.
 *
 * Source of truth:
 * https://support.globalsign.com/ssl/products/alphassl/alphassl-root-and-intermediate-certificates
 *
 * R6 2025 SHA-1: 43:19:55:E6:E5:DA:BE:85:7F:13:36:C0:23:68:E5:49:5F:14:3E:ED
 * R46 2025 SHA-1: E7:AE:6D:3B:B2:65:B2:04:B7:EA:3D:73:2E:DE:C0:79:9A:B2:24:88
 */
const GLOBALSIGN_GCC_R6_ALPHASSL_CA_2025 = `-----BEGIN CERTIFICATE-----
MIIFjTCCA3WgAwIBAgIRAIN9TriekS/nLK07x2kt3CAwDQYJKoZIhvcNAQELBQAw
TDEgMB4GA1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjYxEzARBgNVBAoTCkds
b2JhbFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMjUwNTIxMDIzNjUyWhcN
MjcwNTIxMDAwMDAwWjBVMQswCQYDVQQGEwJCRTEZMBcGA1UEChMQR2xvYmFsU2ln
biBudi1zYTErMCkGA1UEAxMiR2xvYmFsU2lnbiBHQ0MgUjYgQWxwaGFTU0wgQ0Eg
MjAyNTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJ/oiu0Bviq52UUE
ADbFWmgu3rC7KDSMoorLN1Wd03McG3Z1aP71DlPCE33838r72Dfuj5M9LXfiQLJp
Au6MwNExmKOzothw4x0zGf5oBYyrCMGm3fBpLPafwYQ3MchBOWMTbf83rKUPLH48
KCJ0MnU8GUl8oA/J81wIvbbKPuNrFf6hvJDccjzc4NyxLz3A89zjV2g5whCg5O0u
9YX4Zxk9JHuc/LvllOJO4waAYLjbWBJkz3rV3ts1SmSYnJqmyRTIjXwQgRvhEYqt
DbRskt0W7M6cPwCze3GTBN2UHNpHkMs3YmVxku68I0aOQn5+uz//fDROP3z1Z/7I
APteRtECAwEAAaOCAV8wggFbMA4GA1UdDwEB/wQEAwIBhjAdBgNVHSUEFjAUBggr
BgEFBQcDAQYIKwYBBQUHAwIwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU
xbSTj28r3B5Iv7cQMIXO0bK7SC0wHwYDVR0jBBgwFoAUrmwFo5MT4qLn4tcc1sfw
f8hnU6AwewYIKwYBBQUHAQEEbzBtMC4GCCsGAQUFBzABhiJodHRwOi8vb2NzcDIu
Z2xvYmFsc2lnbi5jb20vcm9vdHI2MDsGCCsGAQUFBzAChi9odHRwOi8vc2VjdXJl
Lmdsb2JhbHNpZ24uY29tL2NhY2VydC9yb290LXI2LmNydDA2BgNVHR8ELzAtMCug
KaAnhiVodHRwOi8vY3JsLmdsb2JhbHNpZ24uY29tL3Jvb3QtcjYuY3JsMCEGA1Ud
IAQaMBgwCAYGZ4EMAQIBMAwGCisGAQQBoDIKAQMwDQYJKoZIhvcNAQELBQADggIB
AB/uvBuZf4CiuSahwiXn4geF52roAH+6jxsEPTXTfb7bbeMDXsYgRRsOTNA70ruZ
Tnz5DfFMuBhNoFhIFb0qR1izdy6VkdKOqFPNF2dOFI1EcnY9l2ory9mrzHqVbrL4
vzUd17FLUVyjTVU7PAv4nxyhnO1GTeT83YlrdRF31NyR6bvZVTEERHmpbWSgeveJ
LRtaMzlGWiLZ8IwkH7o6GH3jp/KPtDW4Npu8w64HrRZdN2pqQhi7+YKwfHM7H+2U
dM1BGN0sjOWMVbMSB9MtCsleS2Mb7TRZEbOHxECJLLIluQypZr7Pol3+hAqrhyKI
k+6y+Da0NeDuWxW59Ku4NvClqW1UFX1SpfNGhzVfp/CH+vPM1tySomx2jE0EnYZu
GwVucXPBsp5nUWqUV9+143glVuS7GTg9hFPjNBInn17HbCoIIQIOzj5Vd9bK3A9U
GxXNpwenDHEalCsD/4eQYDHPhFE7sNe0D/OXu+FAM02VZkARx37Jp4bDdujvgL9P
vZPR3wThvDN1CTU8Bc3xea3yKFAraKcPZLkhReQUAm2VpR+HSJRPlUpYizlF9WkL
h3KcAVCBJWvnOkVwxyU5QJMcnwW95JlOtx+9100GL99jHE5rs3gXp7F4bg8H01QT
9jVOhBBmQ7nQoXuwI0tqal2QUqZz3eeu62CU7xBwtfYR
-----END CERTIFICATE-----`;

const GLOBALSIGN_GCC_R46_ALPHASSL_CA_2025 = `-----BEGIN CERTIFICATE-----
MIIFfjCCA2agAwIBAgIRAIRDWG9jliZDgTN8gBouYRgwDQYJKoZIhvcNAQELBQAw
RjELMAkGA1UEBhMCQkUxGTAXBgNVBAoTEEdsb2JhbFNpZ24gbnYtc2ExHDAaBgNV
BAMTE0dsb2JhbFNpZ24gUm9vdCBSNDYwHhcNMjUwOTE3MDI1NTMwWhcNMjkwNjIz
MDAwMDAwWjBWMQswCQYDVQQGEwJCRTEZMBcGA1UEChMQR2xvYmFsU2lnbiBudi1z
YTEsMCoGA1UEAxMjR2xvYmFsU2lnbiBHQ0MgUjQ2IEFscGhhU1NMIENBIDIwMjUw
ggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCV0s/1NfwruxzhrfoOWN/B
V8j/6KxInyuIpVJ50pmHimyU5ACjC4ST2ZyU2Ltggfc/ydc1OrTUqDyoTGjWOazH
obK+GQQtBd+MUEykZbnVCfNj14Um7UiqTGOFaOK551Etd9aE/F9/hYl+4XMXJPqC
+V3ziJbO0QQcL4/wZBvqbW3xZjqb/bcLKHttfNF+JMmO+DrT9VWyomNWVeC3Grs4
DybZLgs4RVmg8sp/Ic0quOdBjIhE+W0jYbUW6Z9HP9q2lh7UVCwn1rZ1mFTRhIXa
shGqL43uXnXfRls3T93w2dnCpgTundq28WmWuzb/RZ6kHvALQmu8f891gHfbb+kb
AgMBAAGjggFVMIIBUTAOBgNVHQ8BAf8EBAMCAYYwEwYDVR0lBAwwCgYIKwYBBQUH
AwEwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUo0yssb+0iO2LdNhfNDjJ
6QolnnswHwYDVR0jBBgwFoAUA1yrc4GHqMywptWU4jaWSf8FmSwwewYIKwYBBQUH
AQEEbzBtMC4GCCsGAQUFBzABhiJodHRwOi8vb2NzcC5nbG9iYWxzaWduLmNvbS9y
b290cjQ2MDsGCCsGAQUFBzAChi9odHRwOi8vc2VjdXJlLmdsb2JhbHNpZ24uY29t
L2NhY2VydC9yb290cjQ2LmNydDA2BgNVHR8ELzAtMCugKaAnhiVodHRwOi8vY3Js
Lmdsb2JhbHNpZ24uY29tL3Jvb3RyNDYuY3JsMCEGA1UdIAQaMBgwCAYGZ4EMAQIB
MAwGCisGAQQBoDIKAQMwDQYJKoZIhvcNAQELBQADggIBAFidiFkGjaslf0o1kWbY
Y1Fe0N/OtR28cj5js0b6mhb0AXgyi8m3IOBBnHFsyGb/OGpGlsfnyOCNHNc4p12Z
f8tqkqtd1qh2oks7+MvEAatwDy4NMlQYmjRpdTzTu6+HFv3waK+UOHbm1NC5s5fb
lPjio082KdjQsG+isWSCUGP7hjVjTcPioy5v0HJDYzmbX1oro7fa7potZ4vjNPRI
mMH2St+E2OphOO4NkrllXtSUw5ThyiFaymFIvWfSXSWOHIcK3HwOlUxgpgrJMDi0
ZuKX3W2+wDVRmrPJXgaX+6R/uBqtdMi2O+ebkjmS5zyk2U7sHsaa9lPQz3PS5hBv
aeW0FHeJK4Yc2yeQ/HBRL3YORG5JQdH1+P/+OJnv7s10Qjipe0tPwHccfMSprzRs
0t/2wG3b2GdTBX9JJjxWp3SJs/Bib7ScMJYyMMgrUBQ/BSCreEpvKvrsw2SAsPwY
dx7fjCpsFBM0Tdrqzc1HUm/qNgETPA6tWTMn+27ot19Q94KpnEHYL1hRyCJ5JB/6
OWVNCbn2YhtwJON6787ZbkVHOz9itAZKajPNH/nO/wB4gtlhnQb1yhZ6nG6LZAsu
gJBL58/BSqH1KWGnHyp9s7VwFJPI3LoSEqLd5BryAOQg/5P5uW339YFmbJCcqS3G
3CVvDrQnx+qrRlxBrS/QeigQ
-----END CERTIFICATE-----`;

const FAMILY_BY_EXTRA_INTERMEDIATES = [
  GLOBALSIGN_GCC_R6_ALPHASSL_CA_2025,
  GLOBALSIGN_GCC_R46_ALPHASSL_CA_2025,
] as const;

const FAMILY_BY_CA_BUNDLE = [...rootCertificates, ...FAMILY_BY_EXTRA_INTERMEDIATES];

function isFamilyByHostname(hostname: string): boolean {
  return hostname.toLowerCase().replace(/^www\./, "") === "family.by";
}

/**
 * Return a CA bundle only for family.by HTTPS requests. The bundle extends
 * Node's normal trusted roots with GlobalSign's published AlphaSSL
 * intermediates so an incomplete server chain can still be verified.
 */
export function resolveSourceSpecificTlsCa(url: URL): readonly string[] | undefined {
  if (url.protocol !== "https:" || !isFamilyByHostname(url.hostname)) {
    return undefined;
  }

  return FAMILY_BY_CA_BUNDLE;
}

/** Exposed for a narrow regression test of the pinned public certificates. */
export function getFamilyByIntermediateCertificates(): readonly X509Certificate[] {
  return FAMILY_BY_EXTRA_INTERMEDIATES.map((pem) => new X509Certificate(pem));
}
