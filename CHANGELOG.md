
## [0.8.0](https://github.com/sassoftware/postgrest-client/compare/v0.7.1...v0.8.0) (2026-08-26)

### ⚠ BREAKING CHANGES

* support for request options ([#36](https://github.com/sassoftware/postgrest-client/issues/36))

### Features

* support for request options ([#36](https://github.com/sassoftware/postgrest-client/issues/36)) ([dd45fc4](https://github.com/sassoftware/postgrest-client/commit/dd45fc44c8d7f41db8d7f297e10830f19f02a428))

## [0.7.1](https://github.com/sassoftware/postgrest-client/compare/v0.7.0...v0.7.1) (2024-10-01)

### Bug Fixes

* edge cases for nullable json types ([#26](https://github.com/sassoftware/postgrest-client/issues/26)) ([fae09a8](https://github.com/sassoftware/postgrest-client/commit/fae09a87782db1fe2cfd9211123842aab686d11b))
* json order regression ([#27](https://github.com/sassoftware/postgrest-client/issues/27)) ([c3d3420](https://github.com/sassoftware/postgrest-client/commit/c3d34202cb66bd6ebda4b6a010a9fc83d9d4d4e4))
* string | null when JSON type is unknown ([#20](https://github.com/sassoftware/postgrest-client/issues/20)) ([326152f](https://github.com/sassoftware/postgrest-client/commit/326152f009f9c329445cae352a7c320bfe435f86))

## [0.7.0](https://github.com/sassoftware/postgrest-client/compare/v0.6.2...v0.7.0) (2024-06-07)

### Features

* top level filter (!inner) ([#12](https://github.com/sassoftware/postgrest-client/issues/12)) ([253ef91](https://github.com/sassoftware/postgrest-client/commit/253ef9157b0690f8070b006fe328c332ee5b943a))
* top level ordering ([#14](https://github.com/sassoftware/postgrest-client/issues/14)) ([eb2948d](https://github.com/sassoftware/postgrest-client/commit/eb2948d303d735d25daca4f414bd3733d2bb92d0))

## [0.6.2](https://github.com/sassoftware/postgrest-client/compare/v0.6.1...v0.6.2) (2024-03-27)

### Bug Fixes

* allow capital letters in json selectors ([#9](https://github.com/sassoftware/postgrest-client/issues/9)) ([4683124](https://github.com/sassoftware/postgrest-client/commit/4683124a2e35f8af32b8fbacc3573dd31fa1bb65))
* support for null in horizontal filtering ([#10](https://github.com/sassoftware/postgrest-client/issues/10)) ([0bd4877](https://github.com/sassoftware/postgrest-client/commit/0bd4877f157aa0662a7a1db40ee66e27b3e1fabf))

## [0.6.1](https://github.com/sassoftware/postgrest-client/compare/v0.6.0...v0.6.1) (2024-03-05)

### Bug Fixes

* missing headers for some requests ([#4](https://github.com/sassoftware/postgrest-client/issues/4)) ([351c9d7](https://github.com/sassoftware/postgrest-client/commit/351c9d7f17a607133e494f6b6bad2dda36f81421))

## 0.6.0 (2024-01-18)

## 0.6.0 (2024-01-12)

- fix: projects with moduleResolution: "node" could not find types (#68)
- feat: missing and columns (support for default values in inserts) (#65)
- fix: special characters (#66)
- fix: disallow (->>) string query for typed method selectJson (#64)
- fix: rename modifier works for all selectors (#63)
- fix: exported forgotten delete response type (#62)

## 0.5.1 (2023-12-13)

- fix: pagesLength null and last page (#56)

## 0.5.0 (2023-12-07)

- fix: PostgresTable type to accept null type for columns (#54)
- feat: implement url encoding constructor config (#46)

## 0.4.0 (2023-11-23)

- feat: untyped (dynamic) support (#43)
- fix: cardinality validation on empty array issue (#45)
- feat: support for nullable embedded query (#42)
- fix: logical filters duplication issue (#41)

## 0.3.0 (2023-11-20)

- feat: Query and response types export (#38)
- fix: preserve headers after another filter (#39)

## 0.2.0 (2023-11-14)

- feat: JSON support (#30)

## 0.1.0 (2023-10-20)

- feat: casting (#14)
- feat: custom header support (#19)
- feat: HTTP methods (#10)
- feat: vertical filtering and embedding (#6)
- feat: order, offset and limit (#3)
- feat: header modifiers (#4)
- feat: horizontal filtering and logical operators (#1)
