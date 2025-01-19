import * as anchor from '@coral-xyz/anchor'
import * as sb from '@switchboard-xyz/on-demand'
import { Program } from '@coral-xyz/anchor'
import { Tokenlottery } from '../target/types/tokenlottery'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
// import SwitchboardIDL from '../../switchboard.json'

describe('tokenlottery', () => {
  jest.setTimeout(60000)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.Tokenlottery as Program<Tokenlottery>;

  //@ts-ignore
  let switchboardProgram;
  const rngKp = anchor.web3.Keypair.generate();

  beforeAll(async () => {
    const switchboardIDL = await anchor.Program.fetchIdl(
      sb.ON_DEMAND_MAINNET_PID,
      { connection: new anchor.web3.Connection("https://api.mainnet-beta.solana.com") }
    );
    switchboardProgram = new anchor.Program(switchboardIDL as anchor.Idl, provider)
  });

  async function buyTicket() {
    const buyTicketIx = await program.methods.buyTicket()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID
      }).instruction();

    const computeTx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit(
      {
        units: 300000
      }
    );

    const priorityIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice(
      {
        microLamports: 1
      }
    )
    const blockhashWithContext = await provider.connection.getLatestBlockhash();
    const tx = new anchor.web3.Transaction(
      {
        feePayer: provider.wallet.publicKey,
        blockhash: blockhashWithContext.blockhash,
        lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight

      }
    ).add(buyTicketIx)
      .add(computeTx)
      .add(priorityIx);

    const sign = await anchor.web3.sendAndConfirmTransaction(
      provider.connection, tx, [wallet.payer], { skipPreflight: true }
    );

    console.log(`Buy ticket Signature ${sign}`);


  }

  it('Initialize TokenLottery', async () => {
    const initConfigIx = await program.methods.initializeConfig(
      new anchor.BN(0),
      new anchor.BN(1836145772),
      new anchor.BN(0),
    ).instruction();

    const blockhashWithContext = await provider.connection.getLatestBlockhash();

    const tx = new anchor.web3.Transaction(
      {
        feePayer: provider.wallet.publicKey,
        blockhash: blockhashWithContext.blockhash,
        lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
      }
    ).add(initConfigIx)

    const ConfigSign = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      tx,
      [wallet.payer],
      { skipPreflight: true },
    )
    console.log("your transaction signature", ConfigSign);

    const initLotteryIx = await program.methods.initializeLottery().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();

    const initLotteyTx = new anchor.web3.Transaction(
      {
        feePayer: provider.wallet.publicKey,
        blockhash: blockhashWithContext.blockhash,
        lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
      }
    ).add(initLotteryIx);

    const initLotterySign = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      initLotteyTx,
      [wallet.payer],
      { skipPreflight: true },
    );
    console.log("Your Token lottery Signature: ", initLotterySign);
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();

    const queue = new anchor.web3.PublicKey(sb.ON_DEMAND_MAINNET_QUEUE)

    //@ts-ignore
    const queueAccount = new sb.Queue(switchboardProgram, queue)

    try{
      await queueAccount.loadData();
    } catch(err) {
      console.log("Queue account not found");
      process.exit(1);
    }

    //@ts-ignore
    const [randomness, ix] = await sb.Randomness.create(switchboardProgram, rngKp, queue)


    // transaction instructions to a versioned transaction. (asV0Tx)
    const createRandomnessTx = await sb.asV0Tx({
      connection: provider.connection,
      ixs: [ix],
      payer: wallet.publicKey,
      signers: [wallet.payer, rngKp],
      // computeUnitPrice: 75_000,
      // computeUnitLimitMultiple: 1.3 
    })

    const createRandomnesSign = await provider.connection.sendTransaction(createRandomnessTx);

    console.log("createRandomnesSign: ", createRandomnesSign);
    

    const sbCommitIx = await randomness.commitIx(queue)
    const commitIx  = await program.methods.commitRandomness()
    .accounts(
      {
        randomnessAccount: randomness.pubkey
      }
    ).instruction()


    const commitComputeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit(
      {
        units: 100000
      }
    )

    const commitPriorityIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports:1
    })


    const commitBlockHashWithContext = await provider.connection.getLatestBlockhash()
    const commitTx = new anchor.web3.Transaction(
      {
        feePayer: provider.wallet.publicKey,
        blockhash: commitBlockHashWithContext.blockhash,
        lastValidBlockHeight: commitBlockHashWithContext.lastValidBlockHeight,
      }
    )
    .add(commitComputeIx)
    .add(commitPriorityIx)
    .add(sbCommitIx)
    .add(commitIx)

    const Commitsign = await anchor.web3.sendAndConfirmTransaction(
      provider.connection, commitTx, [wallet.payer], {skipPreflight: true}
    )

    console.log("commit sign: ", Commitsign);
  
    const sbRevealIx = await randomness.revealIx()

    const revealIx  = await program.methods.chooseWinner()
    .accounts(
      {
        randomnessAccountData: randomness.pubkey
      }
    )
    .instruction();

    const revealTx = await sb.asV0Tx({
      // @ts-ignore
      connection: provider.connection,
      ixs: [sbRevealIx, revealIx],
      payer: wallet.publicKey,
      signers: [wallet.payer],
      // computeUnitPrice: 75_000,
      // computeUnitLimitMultiple: 1.3
    })

    const revealSign = await provider.connection.sendTransaction(revealTx);

    const blockhashContext = await provider.connection.getLatestBlockhashAndContext()
    await provider.connection.confirmTransaction({
      signature: revealSign,
      blockhash: blockhashContext.value.blockhash,
      lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight
    })
    console.log("transaction: ", revealSign);
    
  })
})
