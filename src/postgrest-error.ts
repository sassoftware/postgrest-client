/*
Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

import { HttpMethod } from './types';

export type PostgrestErrorResponseData = {
  hint: string | null;
  details: string | null;
  code: string;
  message: string;
};

export class PostgrestError<
  Method extends HttpMethod,
  Data = Method extends 'HEAD'
    ? null | PostgrestErrorResponseData
    : PostgrestErrorResponseData,
> extends Error {
  status: number;
  statusText: string;
  data: Data;
  headers: Headers;

  constructor(
    status: number,
    statusText: string,
    data: Data,
    headers: Headers,
  ) {
    super(`Request failed with status code ${status}`);

    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.headers = headers;
  }
}
