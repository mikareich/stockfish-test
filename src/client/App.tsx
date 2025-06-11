import { Chess, DEFAULT_POSITION } from "chess.js";
import { useEffect, useRef, useState } from "react";
import StockfishEngine, {
  type EngineState,
  type Evaluation,
} from "./StockfishEngine";

export function App() {
  const [state, setState] = useState<EngineState | null>(null);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const engineRef = useRef<StockfishEngine | null>(null);
  const controllerRef = useRef<AbortController>(new AbortController());

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;

    engineRef.current.isReady.then(() => {
      setState(engineRef.current?.state || null);
    });

    return () => engine.destroy();
  }, []);

  const evaluatePosition = async () => {
    setError(null);

    const engine = engineRef.current;
    const controller = controllerRef.current;

    if (!engine) {
      return;
    } else {
      await engine.isReady;
    }

    if (state === "evaluating") controller.abort();

    try {
      new Chess(position);
    } catch {
      setError("The provided FEN string is malformed.");
      return;
    }

    for await (const evaluation of engine.evaluatePosition(position || "", {
      depth: 1000,
      signal: controller.signal,
    })) {
      setState(engine.state);
      setEvaluation(evaluation);
    }

    setState(engine.state);
  };

  return (
    <main className="container">
      <h1>Stockfish Web</h1>
      <p>
        This example uses a Web Worker to run the Stockfish chess engine without
        blocking the user interface.
      </p>

      {error && <p className="error">{error}</p>}

      <form>
        <label htmlFor="position">
          <span>Game Position (FEN String)</span>

          <input
            defaultValue={position}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            name="position"
            id="position"
            placeholder="FEN String"
          />
        </label>

        <button type="button" onClick={evaluatePosition}>
          {state === "evaluating" ? "Stop evaluating" : "Evaluate best move"}
        </button>
      </form>

      <pre>{JSON.stringify(evaluation, null, 2)}</pre>
    </main>
  );
}
