# skylark-curl
a CLI passthru to curl that will HMAC-sign requests for you 

## Install

```
npm install -g git+ssh://git@github.com:swift-nav/skylark-curl.git
```

## Usage

Fetch an auth token/secret pair:

```
skylark-curl -v http://localhost:3030/auth/token -X OST
```

Use your token and secret to make requests:

```
skylark-curl -v http://localhost:3030/accounts -X POST --data "{...}" --token f977f37e-abcd-abcd-abcd-7904211421e0 --secret 0xdeadbeef0xdeadbeef0xdeadbeef0xdeadbeef0xdeadbeef0xdeadbeef0xdeadbeef0xdeadbeefa6fb1faa7eef26747c9b0b375f2ccce6566201b51c7e14f4
```
