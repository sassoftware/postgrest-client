# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [v0.7.0](https://github.com/sassoftware/postgrest-client/releases/tag/v0.7.0) - 2024-06-03

- [`eb2948d`](https://github.com/sassoftware/postgrest-client/commit/eb2948d303d735d25daca4f414bd3733d2bb92d0) feat: top level ordering (#14)
- [`253ef91`](https://github.com/sassoftware/postgrest-client/commit/253ef9157b0690f8070b006fe328c332ee5b943a) feat: top level filter (!inner) (#12)

## [v0.6.2](https://github.com/sassoftware/postgrest-client/releases/tag/v0.6.2) - 2024-03-25

- [`4683124`](https://github.com/sassoftware/postgrest-client/commit/4683124a2e35f8af32b8fbacc3573dd31fa1bb65) fix: allow capital letters in json selectors (#9)
- [`0bd4877`](https://github.com/sassoftware/postgrest-client/commit/0bd4877f157aa0662a7a1db40ee66e27b3e1fabf) fix: support for null in horizontal filtering (#10)

## [v0.6.1](https://github.com/sassoftware/postgrest-client/releases/tag/v0.6.1) - 2024-03-04

- [`351c9d7`](https://github.com/sassoftware/postgrest-client/commit/351c9d7f17a607133e494f6b6bad2dda36f81421) fix: missing headers for some requests (#4)

## v0.6.0 - 2024-01-12

- fix: projects with moduleResolution: "node" could not find types (#68)
- feat: missing and columns (support for default values in inserts) (#65)
- fix: special characters (#66)
- fix: disallow (->>) string query for typed method selectJson (#64)
- fix: rename modifier works for all selectors (#63)
- fix: exported forgotten delete response type (#62)

## v0.5.1 - 2023-12-13

- fix: pagesLength null and last page (#56)

## v0.5.0 - 2023-12-07

- fix: PostgresTable type to accept null type for columns (#54)
- feat: implement url encoding constructor config (#46)

## v0.4.0 - 2023-11-23

- feat: untyped (dynamic) support (#43)
- fix: cardinality validation on empty array issue (#45)
- feat: support for nullable embedded query (#42)
- fix: logical filters duplication issue (#41)

## v0.3.0 - 2023-11-20

- feat: Query and response types export (#38)
- fix: preserve headers after another filter (#39)

## v0.2.0 - 2023-11-14

- feat: JSON support (#30)

## v0.1.0 - 2023-10-20

- feat: casting (#14)
- feat: custom header support (#19)
- feat: HTTP methods (#10)
- feat: vertical filtering and embedding (#6)
- feat: order, offset and limit (#3)
- feat: header modifiers (#4)
- feat: horizontal filtering and logical operators (#1)
