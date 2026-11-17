# Test signing key

`test-key.p12` signs the **test APKs** that GitHub Actions builds. Every build uses the same key, so a new APK installs over the old one.

- PKCS12, alias `test`, password `skylinesniper`, made with `openssl`, valid for 30 years.
- **This key is public. Never use it for Google Play.** A Play release gets its own private upload key, stored as a GitHub secret.
