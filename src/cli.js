#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { dcutr } from '@libp2p/dcutr'
import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'

const home = os.homedir()

function configDir () {
  return process.env.AGENTCHAT_RELAY_CONFIG_DIR || path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'agentchat-relay')
}

function identityPath () {
  return path.join(configDir(), 'identity.json')
}

async function loadOrCreateIdentity () {
  await fs.mkdir(configDir(), { recursive: true, mode: 0o700 })
  try {
    const saved = JSON.parse(await fs.readFile(identityPath(), 'utf8'))
    const privateKey = privateKeyFromProtobuf(Buffer.from(saved.private_key_protobuf_base64, 'base64'))
    return { privateKey, peerId: peerIdFromPrivateKey(privateKey) }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  const privateKey = await generateKeyPair('Ed25519')
  const peerId = peerIdFromPrivateKey(privateKey)
  await fs.writeFile(identityPath(), `${JSON.stringify({
    type: 'Ed25519',
    private_key_protobuf_base64: Buffer.from(privateKeyToProtobuf(privateKey)).toString('base64'),
    peer_id: peerId.toString(),
    created_at: new Date().toISOString()
  }, null, 2)}\n`, { mode: 0o600 })
  return { privateKey, peerId }
}

function parseArgs (args) {
  const opts = {
    listen: ['/ip4/0.0.0.0/tcp/4001/ws'],
    maxReservations: 512
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--listen') opts.listen = [args[++i]]
    else if (arg === '--max-reservations') opts.maxReservations = Number(args[++i])
    else if (arg === '--help' || arg === '-h') opts.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return opts
}

function print (data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

async function main () {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    print({
      usage: 'agentchat-relay [--listen <multiaddr>] [--max-reservations <n>]',
      default_listen: '/ip4/0.0.0.0/tcp/4001/ws'
    })
    return
  }

  const { privateKey, peerId } = await loadOrCreateIdentity()
  const node = await createLibp2p({
    privateKey,
    addresses: {
      listen: opts.listen
    },
    transports: [
      tcp(),
      webSockets()
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: () => false
    },
    services: {
      identify: identify(),
      dcutr: dcutr(),
      relay: circuitRelayServer({
        reservations: {
          maxReservations: opts.maxReservations
        }
      })
    }
  })

  print({
    success: true,
    peer_id: peerId.toString(),
    addresses: node.getMultiaddrs().map(addr => addr.toString()),
    identity: identityPath(),
    max_reservations: opts.maxReservations,
    stores_messages: false
  })

  await new Promise(resolve => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })
  await node.stop()
}

main().catch(err => {
  process.stderr.write(`${JSON.stringify({ success: false, error: err.message }, null, 2)}\n`)
  process.exitCode = 1
})
