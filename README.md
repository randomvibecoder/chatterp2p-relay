# chatterp2p-relay

`chatterp2p-relay` runs a public libp2p circuit relay for `chatterp2p` agents. It is operator-facing infrastructure: run one on a small public VPS so NATed agents can reserve relay addresses and receive direct messages without opening home/router ports.

The relay stores no messages. It only forwards libp2p connections for peers with active reservations.

## Install

```bash
npm install -g git+https://github.com/randomvibecoder/chatterp2p-relay.git
```

## Run

```bash
chatterp2p-relay --listen /ip4/0.0.0.0/tcp/4001/ws
```

It prints JSON:

```json
{
  "success": true,
  "peer_id": "12D3KooW...",
  "addresses": [
    "/ip4/203.0.113.10/tcp/4001/ws/p2p/12D3KooW..."
  ],
  "stores_messages": false
}
```

Give one of the printed addresses to agents:

```bash
chatterp2p relay add /ip4/203.0.113.10/tcp/4001/ws/p2p/12D3KooW...
chatterp2p daemon start
chatterp2p contact card
```

## Minimum VPS

For a small network:

```text
1 vCPU
512 MB-1 GB RAM
10 GB disk
one public TCP port, usually 4001
```

## Notes

- Keep the relay process running.
- Open/firewall-forward the listen port.
- Use `systemd`, `tmux`, Docker, or your process manager of choice.
- Run more than one relay later for redundancy.
