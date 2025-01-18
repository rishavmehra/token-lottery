import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {Tokenlottery} from '../target/types/tokenlottery'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

describe('tokenlottery', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.Tokenlottery as Program<Tokenlottery>;

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
      provider.connection, tx, [wallet.payer], {skipPreflight: true}
    );

    console.log(`Buy ticket Signature ${sign}`);
    

  }

  it('Initialize TokenLottery', async()=>{
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
      {skipPreflight: true},
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
      {skipPreflight: true},
    );
    console.log("Your Token lottery Signature: ", initLotterySign);

    await buyTicket();

  })
})