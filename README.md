# ⛏️ MultiCoin Mining Pool

Mining pool supporting KAS, RVN, and ALPH cryptocurrencies.

## Features

- ⚡ Multi-coin mining (KAS, RVN, ALPH)
- 🔌 Stratum servers on ports 3333, 3334, 3336
- 📊 Live dashboard on port 10000
- 🔄 24/7 automatic mining
- 🐳 Docker support

## Environment Variables

```
NODE_ENV=production
PORT=10000
KAS_WALLET=kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86
RVN_WALLET=REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y
ALPH_WALLET=1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b
```

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/mining-pool)

## Ports

- **10000**: Dashboard & API
- **3333**: KAS Stratum (kHeavyHash)
- **3334**: RVN Stratum (KawPoW)
- **3336**: ALPH Stratum (Blake3)

## Miner Connection

### Kaspa (KAS)
```bash
./ksminer --pool stratum+tcp://YOUR_HOST:3333 --wallet YOUR_WALLET --worker worker1
```

### Ravencoin (RVN)
```bash
./t-rex -a kawpow -o stratum+tcp://YOUR_HOST:3334 -u YOUR_WALLET -p x
```

### Alephium (ALPH)
```bash
./lolMiner -a BLAKE3 -o stratum+tcp://YOUR_HOST:3336 -u YOUR_WALLET -p x
```

## API Endpoints

- `/api/health` - Health check
- `/api/live-stats` - Live mining stats
- `/api/pool/config` - Pool configuration

## License

MIT
