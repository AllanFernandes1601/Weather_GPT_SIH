import React, { useEffect, useRef } from 'react';
import { calculateRiskGaugeSnapshot, RiskInputs } from '../utils/riskEngine';

interface RiskWeatherCanvasProps {
  inputs: RiskInputs;
}

interface RainParticle {
  x: number;
  y: number;
  length: number;
  speedScale: number;
}

interface WindParticle {
  x: number;
  y: number;
  length: number;
  speedScale: number;
}

interface CanvasState {
  width: number;
  height: number;
  dpr: number;
  waterStart: number;
  waterCurrent: number;
  waterTarget: number;
  waterTransitionStarted: number;
  rainCurrent: number;
  rainTarget: number;
  windCurrent: number;
  windTarget: number;
  windKmhCurrent: number;
  windKmhTarget: number;
  heatStart: number;
  heatCurrent: number;
  heatTarget: number;
  heatTransitionStarted: number;
  hazeCurrent: number;
  hazeTarget: number;
  particles: RainParticle[];
  windParticles: WindParticle[];
  lastFrame: number;
}

const WATER_TRANSITION_MS = 800;
const SKY_TRANSITION_MS = 1500;
const INPUT_THROTTLE_MS = 100;
const MAX_PARTICLES = 100;
const MAX_WIND_PARTICLES = 40;
const GALE_THRESHOLD_KMH = 62;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

function createParticle(width: number, height: number, startAbove = false): RainParticle {
  return {
    x: Math.random() * width,
    y: startAbove ? -Math.random() * height * 0.35 : Math.random() * height,
    length: 8 + Math.random() * 12,
    speedScale: 0.72 + Math.random() * 0.56
  };
}

function createWindParticle(width: number, height: number, startLeft = false): WindParticle {
  return {
    x: startLeft ? -Math.random() * width * 0.25 : Math.random() * width,
    y: 12 + Math.random() * height * 0.46,
    length: 8 + Math.random() * 18,
    speedScale: 0.7 + Math.random() * 0.65
  };
}

function mixColor(from: number[], to: number[], amount: number): string {
  const mixed = from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function skyColors(heatRisk: number): [string, string] {
  const normalized = clamp(heatRisk, 0, 1);
  const coolTop = [207, 224, 235];
  const coolBottom = [241, 247, 250];
  const amberTop = [244, 201, 126];
  const amberBottom = [255, 238, 196];
  const severeTop = [174, 58, 37];
  const severeBottom = [235, 103, 61];

  if (normalized <= 0.5) {
    const amount = normalized * 2;
    return [mixColor(coolTop, amberTop, amount), mixColor(coolBottom, amberBottom, amount)];
  }
  const amount = (normalized - 0.5) * 2;
  return [mixColor(amberTop, severeTop, amount), mixColor(amberBottom, severeBottom, amount)];
}

export const RiskWeatherCanvas: React.FC<RiskWeatherCanvasProps> = ({ inputs }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef(inputs);
  const throttleRef = useRef<number | null>(null);
  const lastCalculationRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const stateRef = useRef<CanvasState>({
    width: 0,
    height: 250,
    dpr: 1,
    waterStart: 0.08,
    waterCurrent: 0.08,
    waterTarget: 0.08,
    waterTransitionStarted: 0,
    rainCurrent: 0,
    rainTarget: 0,
    windCurrent: 0,
    windTarget: 0,
    windKmhCurrent: 0,
    windKmhTarget: 0,
    heatStart: 0,
    heatCurrent: 0,
    heatTarget: 0,
    heatTransitionStarted: 0,
    hazeCurrent: 0,
    hazeTarget: 0,
    particles: [],
    windParticles: [],
    lastFrame: 0
  });

  useEffect(() => {
    inputRef.current = inputs;
    const updateTargets = () => {
      const now = performance.now();
      const snapshot = calculateRiskGaugeSnapshot(inputRef.current);
      const state = stateRef.current;
      state.waterStart = state.waterCurrent;
      state.waterTarget = 0.08 + 0.77 * (snapshot.values.flood / 100);
      state.waterTransitionStarted = now;
      state.rainTarget = clamp(inputRef.current.rainMm24h, 0, 115) / 115;
      state.windTarget = snapshot.values.wind / 100;
      state.windKmhTarget = Math.max(0, inputRef.current.windGustKmh);
      state.heatStart = state.heatCurrent;
      state.heatTarget = clamp(snapshot.values.heat / 75, 0, 1);
      state.heatTransitionStarted = now;
      state.hazeTarget = clamp((snapshot.values.aqi - 24) / 76, 0, 1);
      lastCalculationRef.current = now;
      throttleRef.current = null;
    };

    const elapsed = performance.now() - lastCalculationRef.current;
    if (elapsed >= INPUT_THROTTLE_MS) {
      updateTargets();
    } else if (throttleRef.current === null) {
      throttleRef.current = window.setTimeout(updateTargets, INPUT_THROTTLE_MS - elapsed);
    }

    return () => {
      if (throttleRef.current !== null) {
        window.clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [inputs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const state = stateRef.current;
      state.width = Math.max(1, rect.width);
      state.height = Math.max(1, rect.height);
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(state.width * state.dpr);
      canvas.height = Math.round(state.height * state.dpr);
      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (time: number) => {
      const state = stateRef.current;
      const deltaSeconds = Math.min((time - state.lastFrame) / 1000 || 0, 0.05);
      state.lastFrame = time;

      const transitionProgress = clamp((time - state.waterTransitionStarted) / WATER_TRANSITION_MS, 0, 1);
      state.waterCurrent = state.waterStart
        + (state.waterTarget - state.waterStart) * easeOutCubic(transitionProgress);
      const heatTransitionProgress = clamp((time - state.heatTransitionStarted) / SKY_TRANSITION_MS, 0, 1);
      state.heatCurrent = state.heatStart
        + (state.heatTarget - state.heatStart) * easeOutCubic(heatTransitionProgress);
      state.rainCurrent += (state.rainTarget - state.rainCurrent) * Math.min(1, deltaSeconds * 8);
      state.windCurrent += (state.windTarget - state.windCurrent) * Math.min(1, deltaSeconds * 7);
      state.windKmhCurrent += (state.windKmhTarget - state.windKmhCurrent) * Math.min(1, deltaSeconds * 7);
      state.hazeCurrent += (state.hazeTarget - state.hazeCurrent) * Math.min(1, deltaSeconds * 4);

      const desiredParticleCount = Math.round(state.rainCurrent * MAX_PARTICLES);
      while (state.particles.length < desiredParticleCount) {
        state.particles.push(createParticle(state.width, state.height, true));
      }
      if (state.particles.length > desiredParticleCount) {
        state.particles.length = desiredParticleCount;
      }
      const desiredWindParticleCount = Math.round(state.windCurrent * MAX_WIND_PARTICLES);
      while (state.windParticles.length < desiredWindParticleCount) {
        state.windParticles.push(createWindParticle(state.width, state.height, true));
      }
      if (state.windParticles.length > desiredWindParticleCount) {
        state.windParticles.length = desiredWindParticleCount;
      }

      context.clearRect(0, 0, state.width, state.height);
      const waterHeight = state.height * state.waterCurrent;
      const waterLine = state.height - waterHeight;

      // Sky layer (back).
      const [skyTop, skyBottom] = skyColors(state.heatCurrent);
      const skyGradient = context.createLinearGradient(0, 0, 0, state.height);
      skyGradient.addColorStop(0, skyTop);
      skyGradient.addColorStop(1, skyBottom);
      context.fillStyle = skyGradient;
      context.fillRect(0, 0, state.width, state.height);

      // Water layer.
      const phase = (time % 2000) / 2000 * Math.PI * 2;
      const rippleAmplitude = 3.5;
      context.beginPath();
      context.moveTo(0, state.height);
      context.lineTo(0, waterLine);
      for (let x = 0; x <= state.width; x += 5) {
        const y = waterLine
          + Math.sin((x / Math.max(state.width, 1)) * Math.PI * 4 + phase) * rippleAmplitude
          + Math.sin((x / Math.max(state.width, 1)) * Math.PI * 7 - phase * 0.7) * 1.25;
        context.lineTo(x, y);
      }
      context.lineTo(state.width, state.height);
      context.closePath();
      const waterGradient = context.createLinearGradient(0, waterLine, 0, state.height);
      waterGradient.addColorStop(0, 'rgba(14, 165, 233, 0.70)');
      waterGradient.addColorStop(1, 'rgba(3, 105, 161, 0.92)');
      context.fillStyle = waterGradient;
      context.fill();

      // Rain layer.
      if (desiredParticleCount > 0) {
        const fallSpeed = 120 + state.rainCurrent * 360;
        const galeStrength = clamp((state.windKmhCurrent - GALE_THRESHOLD_KMH) / 78, 0, 1);
        const horizontalRainSpeed = galeStrength * (80 + state.windKmhCurrent * 1.7);
        const rainTilt = galeStrength * 13;
        context.beginPath();
        context.strokeStyle = 'rgba(37, 99, 235, 0.48)';
        context.lineWidth = 1.35;
        for (const particle of state.particles) {
          particle.y += fallSpeed * particle.speedScale * deltaSeconds;
          particle.x += (horizontalRainSpeed - fallSpeed * 0.05) * deltaSeconds;
          if (particle.y >= waterLine || particle.x < -particle.length || particle.x > state.width + particle.length) {
            Object.assign(particle, createParticle(state.width, state.height, true));
          }
          context.moveTo(particle.x, particle.y);
          context.lineTo(particle.x - 2.5 + rainTilt, particle.y + particle.length);
        }
        context.stroke();
      }

      // Wind layer.
      if (desiredWindParticleCount > 0) {
        const windSpeed = 34 + state.windKmhCurrent * 2.8;
        context.beginPath();
        context.strokeStyle = 'rgba(55, 65, 81, 0.34)';
        context.lineWidth = 1.5;
        context.lineCap = 'round';
        for (const particle of state.windParticles) {
          particle.x += windSpeed * particle.speedScale * deltaSeconds;
          if (particle.x > state.width + particle.length) {
            Object.assign(particle, createWindParticle(state.width, state.height, true));
          }
          context.moveTo(particle.x, particle.y);
          context.lineTo(particle.x + particle.length, particle.y);
        }
        context.stroke();
        context.lineCap = 'butt';
      }

      // Haze layer (front).
      if (state.hazeCurrent > 0.001) {
        const hazeGradient = context.createLinearGradient(0, 0, state.width, state.height);
        hazeGradient.addColorStop(0, `rgba(82, 86, 89, ${state.hazeCurrent * 0.36})`);
        hazeGradient.addColorStop(0.55, `rgba(112, 112, 108, ${state.hazeCurrent * 0.48})`);
        hazeGradient.addColorStop(1, `rgba(75, 79, 82, ${state.hazeCurrent * 0.42})`);
        context.fillStyle = hazeGradient;
        context.fillRect(0, 0, state.width, state.height);
      }

      animationRef.current = window.requestAnimationFrame(draw);
    };

    animationRef.current = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-[250px] rounded-3xl bg-[#E4EEF4]"
      role="img"
      aria-label="Animated sky, flood water, rain, wind and air-quality haze driven by current WeatherGPT risk inputs."
    >
      Animated weather-risk visualization.
    </canvas>
  );
};
