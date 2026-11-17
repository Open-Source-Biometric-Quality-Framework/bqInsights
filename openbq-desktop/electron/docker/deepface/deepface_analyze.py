import argparse
import json
import os
import sys

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from deepface import DeepFace


def parse_bool(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--detector-backend", default="opencv")
    parser.add_argument("--enforce-detection", default="true")
    parser.add_argument("--include-raw", default="false")
    parser.add_argument("--anti-spoofing", default="true")
    args = parser.parse_args()

    try:
        common_kwargs = {
            "img_path": args.image,
            "actions": ["age", "gender", "emotion", "race"],
            "detector_backend": args.detector_backend,
            "enforce_detection": parse_bool(args.enforce_detection),
            "silent": True,
        }

        anti_spoofing_supported = True
        anti_spoofing_enabled = parse_bool(args.anti_spoofing)
        try:
            result = DeepFace.analyze(
                anti_spoofing=anti_spoofing_enabled,
                **common_kwargs,
            )
        except Exception as err:
            msg = str(err)
            if "anti_spoofing" not in msg and "install torch" not in msg.lower():
                raise
            anti_spoofing_supported = False
            result = DeepFace.analyze(**common_kwargs)

        if isinstance(result, list):
            result = result[0] if result else {}

        payload = {
            "age": result.get("age"),
            "gender": result.get("dominant_gender"),
            "emotion": result.get("dominant_emotion"),
            "race": result.get("dominant_race"),
            "genderProbabilities": result.get("gender") or {},
            "emotionProbabilities": result.get("emotion") or {},
            "raceProbabilities": result.get("race") or {},
            "is_real": result.get("is_real"),
            "antiSpoofingSupported": anti_spoofing_supported,
        }

        if parse_bool(args.include_raw):
            payload["raw"] = result

        print(json.dumps(payload, separators=(",", ":")))
        return 0
    except Exception as err:
        print(json.dumps({"error": str(err)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
