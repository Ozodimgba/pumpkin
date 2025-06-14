import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { PumpFunSDK } from 'pumpdotfun-sdk';
import { CreateTokenDto } from './dto/create-token.dto';
import { BuyTokenDto } from './dto/buy-token.dto';
import { SellTokenDto } from './dto/sell-token.dto';
import bs58 from 'bs58';

@Injectable()
export class PumpFunService {
  private readonly logger = new Logger(PumpFunService.name);
  private connection: Connection;
  private sdk: PumpFunSDK;

  constructor() {
    // Initialize connection - replace with your RPC URL
    const rpcUrl =
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Create a dummy wallet for the provider (actual signing will use provided private keys)
    const wallet = new Wallet(Keypair.generate());
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    this.sdk = new PumpFunSDK(provider);
  }

  async createTokenOnly(createTokenDto: CreateTokenDto) {
    try {
      // Decode private key
      const creatorKeypair = Keypair.fromSecretKey(
        bs58.decode(createTokenDto.creatorPrivateKey),
      );

      // Generate mint keypair
      const mintKeypair = Keypair.generate();

      // Download image from URL and create blob
      const imageResponse = await fetch(createTokenDto.imageUrl);
      if (!imageResponse.ok) {
        throw new BadRequestException(
          'Failed to fetch image from provided URL',
        );
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBlob = new Blob([imageBuffer], {
        type: imageResponse.headers.get('content-type') || 'image/png',
      });

      // Prepare token metadata
      const tokenMetadata = {
        name: createTokenDto.name,
        symbol: createTokenDto.symbol,
        description: createTokenDto.description,
        file: imageBlob,
        twitter: createTokenDto.twitter || '',
        telegram: createTokenDto.telegram || '',
        website: createTokenDto.website || '',
      };

      const slippageBasisPoints = createTokenDto.slippageBasisPoints
        ? BigInt(createTokenDto.slippageBasisPoints)
        : 500n;

      // Create token with 0 SOL buy amount
      this.logger.log('Creating token without initial buy...');
      const createResult = await this.sdk.createAndBuy(
        creatorKeypair,
        mintKeypair,
        tokenMetadata,
        0n, // No initial buy
        slippageBasisPoints,
        {
          unitLimit: 250000,
          unitPrice: 250000,
        },
      );

      if (!createResult.success) {
        throw new BadRequestException(
          'Token creation failed: ' + String(createResult.error),
        );
      }

      this.logger.log(
        'Token created successfully, signature:',
        createResult.signature,
      );

      return {
        success: true,
        mint: mintKeypair.publicKey.toBase58(),
        signature: createResult.signature,
        pumpFunUrl: `https://pump.fun/${mintKeypair.publicKey.toBase58()}`,
        message: 'Token created successfully',
      };
    } catch (error) {
      this.logger.error('Error creating token:', error);
      throw new BadRequestException(
        'Failed to create token: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  async createToken(createTokenDto: CreateTokenDto) {
    try {
      // If no buy amount specified, just create token
      if (
        !createTokenDto.buyAmountSol ||
        parseFloat(createTokenDto.buyAmountSol) === 0
      ) {
        return this.createTokenOnly(createTokenDto);
      }

      // Decode private key
      const creatorKeypair = Keypair.fromSecretKey(
        bs58.decode(createTokenDto.creatorPrivateKey),
      );

      // Generate mint keypair
      const mintKeypair = Keypair.generate();

      this.logger.log('Creating metadata on IPFS...');

      // Create form data for IPFS upload
      const formData = new FormData();

      // Download image and add to form data
      const imageResponse = await fetch(createTokenDto.imageUrl);
      if (!imageResponse.ok) {
        throw new BadRequestException(
          'Failed to fetch image from provided URL',
        );
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBlob = new Blob([imageBuffer], {
        type: imageResponse.headers.get('content-type') || 'image/png',
      });

      formData.append('file', imageBlob);
      formData.append('name', createTokenDto.name);
      formData.append('symbol', createTokenDto.symbol);
      formData.append('description', createTokenDto.description);
      formData.append('twitter', createTokenDto.twitter || '');
      formData.append('telegram', createTokenDto.telegram || '');
      formData.append('website', createTokenDto.website || '');
      formData.append('showName', 'true');

      // Upload metadata to IPFS
      const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
        method: 'POST',
        body: formData,
      });

      if (!metadataResponse.ok) {
        throw new BadRequestException('Failed to upload metadata to IPFS');
      }

      const metadataResponseJSON = (await metadataResponse.json()) as {
        metadataUri: string;
      };

      // Parse parameters
      const buyAmountSol = parseFloat(createTokenDto.buyAmountSol);
      const slippageBasisPoints = createTokenDto.slippageBasisPoints
        ? parseInt(createTokenDto.slippageBasisPoints)
        : 500;

      this.logger.log('Creating bundled transaction with create and buy...');

      // Create bundled transaction arguments
      const bundledTxArgs = [
        {
          publicKey: creatorKeypair.publicKey.toBase58(),
          action: 'create',
          tokenMetadata: {
            name: createTokenDto.name,
            symbol: createTokenDto.symbol,
            uri: metadataResponseJSON.metadataUri,
          },
          mint: mintKeypair.publicKey.toBase58(),
          denominatedInSol: 'true',
          amount: buyAmountSol,
          slippage: slippageBasisPoints / 100, // Convert basis points to percentage
          priorityFee: 0.0005,
          pool: 'pump',
        },
      ];

      // Generate the bundled transaction
      const response = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bundledTxArgs),
      });

      if (response.status !== 200) {
        const errorText = await response.text();
        throw new BadRequestException(
          `Failed to generate transaction: ${errorText}`,
        );
      }

      // Get the transaction data
      const transactions = (await response.json()) as string[];

      if (!Array.isArray(transactions) || transactions.length === 0) {
        throw new BadRequestException(
          'No transactions returned from PumpPortal',
        );
      }

      // Deserialize and sign the transaction
      const tx = VersionedTransaction.deserialize(
        new Uint8Array(bs58.decode(transactions[0])),
      );

      // Sign with both mint and creator keypairs (mint keypair is required for creation)
      tx.sign([mintKeypair, creatorKeypair]);

      this.logger.log('Sending bundled transaction...');

      // Send the transaction
      const signature = await this.connection.sendTransaction(tx, {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      this.logger.log('Transaction sent, signature:', signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        lastValidBlockHeight: await this.connection
          .getLatestBlockhash()
          .then((r) => r.lastValidBlockHeight),
        blockhash: await this.connection
          .getLatestBlockhash()
          .then((r) => r.blockhash),
      });

      if (confirmation.value.err) {
        throw new BadRequestException(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      return {
        success: true,
        mint: mintKeypair.publicKey.toBase58(),
        signature,
        pumpFunUrl: `https://pump.fun/${mintKeypair.publicKey.toBase58()}`,
        message:
          'Token created and initial purchase successful in single atomic transaction',
      };
    } catch (error) {
      this.logger.error('Error creating token:', error);
      throw new BadRequestException(
        'Failed to create token: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  async buyToken(buyTokenDto: BuyTokenDto) {
    try {
      // Decode private key
      const buyerKeypair = Keypair.fromSecretKey(
        bs58.decode(buyTokenDto.buyerPrivateKey),
      );

      // Parse parameters
      const buyAmountSol = parseFloat(buyTokenDto.buyAmountSol);
      const slippageBasisPoints = buyTokenDto.slippageBasisPoints
        ? parseInt(buyTokenDto.slippageBasisPoints)
        : 500;

      const priorityFee = buyTokenDto.priorityFeeMicroLamports
        ? parseFloat(buyTokenDto.priorityFeeMicroLamports) / 1000000 // Convert microlamports to SOL
        : 0.0005;

      this.logger.log('Creating buy transaction via PumpPortal...');

      // Create buy transaction using PumpPortal API
      const response = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: buyerKeypair.publicKey.toBase58(),
          action: 'buy',
          mint: buyTokenDto.mint,
          denominatedInSol: 'true', // Buying with SOL
          amount: buyAmountSol,
          slippage: slippageBasisPoints / 100, // Convert basis points to percentage
          priorityFee: priorityFee,
          pool: 'pump',
        }),
      });

      if (response.status !== 200) {
        const errorText = await response.text();
        throw new BadRequestException(
          `Failed to generate buy transaction: ${errorText}`,
        );
      }

      // Get the transaction data
      const transactionData = await response.arrayBuffer();

      // Deserialize and sign the transaction
      const tx = VersionedTransaction.deserialize(
        new Uint8Array(transactionData),
      );
      tx.sign([buyerKeypair]);

      this.logger.log('Sending buy transaction...');

      // Send the transaction
      const signature = await this.connection.sendTransaction(tx, {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      this.logger.log('Buy transaction sent, signature:', signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        lastValidBlockHeight: await this.connection
          .getLatestBlockhash()
          .then((r) => r.lastValidBlockHeight),
        blockhash: await this.connection
          .getLatestBlockhash()
          .then((r) => r.blockhash),
      });

      if (confirmation.value.err) {
        throw new BadRequestException(
          `Buy transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      return {
        success: true,
        signature,
        mint: buyTokenDto.mint,
        buyAmountSol: buyTokenDto.buyAmountSol,
        message: 'Token purchase successful',
      };
    } catch (error) {
      this.logger.error('Error buying token:', error);
      throw new BadRequestException(
        'Failed to buy token: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  async sellToken(sellTokenDto: SellTokenDto) {
    try {
      // Decode private key
      const sellerKeypair = Keypair.fromSecretKey(
        bs58.decode(sellTokenDto.sellerPrivateKey),
      );

      // Parse parameters
      const sellTokenAmount = sellTokenDto.sellTokenAmount;
      const slippageBasisPoints = sellTokenDto.slippageBasisPoints
        ? parseInt(sellTokenDto.slippageBasisPoints)
        : 500;

      const priorityFee = sellTokenDto.priorityFeeMicroLamports
        ? parseFloat(sellTokenDto.priorityFeeMicroLamports) / 1000000 // Convert microlamports to SOL
        : 0.0005;

      this.logger.log('Creating sell transaction via PumpPortal...');

      // Create sell transaction using PumpPortal API
      const response = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: sellerKeypair.publicKey.toBase58(),
          action: 'sell',
          mint: sellTokenDto.mint,
          denominatedInSol: 'false', // Selling tokens, not SOL
          amount: sellTokenAmount,
          slippage: slippageBasisPoints / 100, // Convert basis points to percentage
          priorityFee: priorityFee,
          pool: 'pump',
        }),
      });

      if (response.status !== 200) {
        const errorText = await response.text();
        throw new BadRequestException(
          `Failed to generate sell transaction: ${errorText}`,
        );
      }

      // Get the transaction data
      const transactionData = await response.arrayBuffer();

      // Deserialize and sign the transaction
      const tx = VersionedTransaction.deserialize(
        new Uint8Array(transactionData),
      );
      tx.sign([sellerKeypair]);

      this.logger.log('Sending sell transaction...');

      // Send the transaction
      const signature = await this.connection.sendTransaction(tx, {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      this.logger.log('Sell transaction sent, signature:', signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        lastValidBlockHeight: await this.connection
          .getLatestBlockhash()
          .then((r) => r.lastValidBlockHeight),
        blockhash: await this.connection
          .getLatestBlockhash()
          .then((r) => r.blockhash),
      });

      if (confirmation.value.err) {
        throw new BadRequestException(
          `Sell transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      return {
        success: true,
        signature,
        mint: sellTokenDto.mint,
        sellTokenAmount: sellTokenDto.sellTokenAmount,
        message: 'Token sale successful',
      };
    } catch (error) {
      this.logger.error('Error selling token:', error);
      throw new BadRequestException(
        'Failed to sell token: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  async getTokenInfo(mint: string) {
    try {
      const mintPublicKey = new PublicKey(mint);
      const bondingCurve = await this.sdk.getBondingCurveAccount(mintPublicKey);

      if (!bondingCurve) {
        throw new BadRequestException(
          'Token not found or bonding curve does not exist',
        );
      }

      return {
        mint,
        virtualTokenReserves: bondingCurve.virtualTokenReserves.toString(),
        virtualSolReserves: bondingCurve.virtualSolReserves.toString(),
        realTokenReserves: bondingCurve.realTokenReserves.toString(),
        realSolReserves: bondingCurve.realSolReserves.toString(),
        tokenTotalSupply: bondingCurve.tokenTotalSupply.toString(),
        complete: bondingCurve.complete,
        marketCapSol: bondingCurve.getMarketCapSOL().toString(),
      };
    } catch (error) {
      this.logger.error('Error getting token info:', error);
      throw new BadRequestException(
        'Failed to get token info: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
