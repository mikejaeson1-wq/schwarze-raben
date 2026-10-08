-- pg_net queues contain the webhook URL. Only the server dispatcher reads them.
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
