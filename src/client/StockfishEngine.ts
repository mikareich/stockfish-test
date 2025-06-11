import { Chess, Move } from "chess.js";
import wasmThreadsSupported from "./wasmThreadsSupported";

export type Score =
  | { type: "cp"; value: number }
  | { type: "mate"; value: number }; // score can the usal +- number, or a mate in x steps

export type ScoreType = Score["type"];

export type Evaluation = {
  depth: number;
  time: number;
  score: Score;
  position: string;
  bestMove: Move;
  ponder: Move;
};

export type EngineState = "initializing" | "idle" | "evaluating";

type Waiter = {
  predicate: (message: string) => boolean;
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
};

export default class StockfishEngine {
  public static DEFAULT_DEPTH = 15;

  private static parseInfoMessage(position: string, message: string) {
    // info depth 1 seldepth 2 multipv 1 score cp 0 nodes 20 nps 2222 hashfull 0 time 9 pv d2d4
    const [
      ,
      ,
      depthValue,
      ,
      seldepthValue,
      ,
      multipvValue,
      ,
      scoreType,
      scoreValue,
      ,
      nodesValue,
      ,
      npsValue,
      ,
      hashfullValue,
      ,
      timeValue,
      ,
      ...moves
    ] = message.split(" ");

    // check assumed formatting
    const assumedMessageString = `info depth ${depthValue} seldepth ${seldepthValue} multipv ${multipvValue} score ${scoreType} ${scoreValue} nodes ${nodesValue} nps ${npsValue} hashfull ${hashfullValue} time ${timeValue} pv ${moves.join(
      " "
    )}`;

    // message is malformed
    if (assumedMessageString !== message) {
      return null;
    }

    // no moves calulated yet
    if (!moves[0] || !moves[1]) return null;

    let bestMove, ponder;
    const game = new Chess(position);

    bestMove = game.move(moves[0]);
    ponder = game.move(moves[1]);

    return {
      depth: Number(depthValue),
      time: Number(timeValue),
      score: { type: scoreType as ScoreType, value: Number(scoreValue) },
      position,
      bestMove,
      ponder,
    } satisfies Evaluation;
  }

  private waiters: Waiter[] = [];
  private worker: Worker;
  private _isReady: Promise<void>;
  private _state: EngineState;

  public get isReady() {
    return this._isReady;
  }

  public get state() {
    return this._state;
  }

  constructor() {
    if (!wasmThreadsSupported()) throw new Error("WASM is not supported");

    this.worker = new Worker("/stockfish-16.1.js");

    this.worker.addEventListener("message", this.handleMessage.bind(this));
    this.worker.addEventListener("error", this.handleError.bind(this));

    this._state = "initializing";
    this._isReady = new Promise(async (resolve) => {
      this.worker.postMessage("isready");
      await this.waitFor((message) => message === "readyok");

      this.worker.postMessage("uci");
      await this.waitFor((message) => message === "uciok");

      this._state = "idle";
      resolve();
    });
  }

  private async waitFor(predicate: Waiter["predicate"]): Promise<string> {
    return new Promise((resolve, reject) => {
      this.waiters.push({ predicate, resolve, reject });
    });
  }

  private handleMessage(e: MessageEvent) {
    const message = e.data;
    const remainingWaiters: Waiter[] = [];

    console.info(message);

    for (const waiter of this.waiters) {
      if (waiter.predicate(message)) waiter.resolve(message);
      else remainingWaiters.push(waiter);
    }

    this.waiters = remainingWaiters;
  }

  private handleError(e: ErrorEvent) {
    this.waiters.forEach((waiter) => waiter.reject(e.error));
    this.waiters = [];
  }

  public async *evaluatePosition(
    position: string,
    options: {
      depth?: number;
      signal?: AbortSignal;
    }
  ): AsyncGenerator<Evaluation | null, void, void> {
    const { depth = StockfishEngine.DEFAULT_DEPTH, signal } = options;

    if (signal?.aborted) {
      return;
    }

    await this.isReady;
    this._state = "evaluating";

    this.worker.postMessage(`position fen ${position}`);
    this.worker.postMessage(`go depth ${depth}`);

    let lastValidEvaluation = null;
    try {
      while (true) {
        const abortPromise = new Promise<never>((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        });

        const message = await Promise.race([
          this.waitFor(() => true),
          abortPromise,
        ]);

        if (message.startsWith("info")) {
          const evaluation = StockfishEngine.parseInfoMessage(
            position,
            message
          );

          if (evaluation) lastValidEvaluation = evaluation;
          yield lastValidEvaluation;
        } else if (message.startsWith("bestmove")) {
          break;
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
    } finally {
      this._state = "idle";
      this.worker.postMessage("stop");
    }
  }

  public destroy() {
    this.worker.postMessage("quit");

    setTimeout(() => this.worker.terminate(), 500);
  }
}
