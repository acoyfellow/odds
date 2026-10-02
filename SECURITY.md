# Security

Report issues privately to jcoeyman@cloudflare.com.

- odds uses a dedicated Cloudflare API token with AI Gateway Run and Workers AI Read on one
  account. It never uses the wrangler OAuth login.
- The token is read at request time from `ODDS_TOKEN`, then the macOS Keychain service
  `odds-gateway`, then `~/.config/odds/token`. The file is refused unless it is chmod 600.
- The token is sent only as a bearer header to `gateway.ai.cloudflare.com`. It is redacted
  from every error message and receipt. `prove:auth` refuses to write a receipt that contains it.
- `prove:auth` checks that calls with no token or a forged token fail. It does not check the
  gateway's own authentication setting.
- The docs site has no bindings, no API and `connect-src 'none'`. It cannot call any model.
