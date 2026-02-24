export type MockResponseState = {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
  sendBody: Buffer | string | null;
};

export function createMockResponse() {
  const state: MockResponseState = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    sendBody: null,
  };

  const response = {
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(value: unknown) {
      state.jsonBody = value;
    },
    send(value: Buffer | string) {
      state.sendBody = value;
    },
  };

  return {
    response,
    state,
  };
}
