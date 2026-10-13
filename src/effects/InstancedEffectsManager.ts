import * as THREE from 'three';
import { GraphicsSettings, getParticleScale } from '../core/GraphicsSettings';

/**
 * InstancedMesh manager for high-frequency, short-lived effects:
 * - Shell casings
 * - Bullet impact sparks/debris
 * - Gibs (flesh/bone chunks)
 * 
 * Uses a single draw call per effect type instead of N draw calls.
 * Dramatically reduces CPU overhead on mobile.
 */

interface InstanceData {
  matrix: THREE.Matrix4;
  color: THREE.Color;
  scale: number;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  active: boolean;
}

export class InstancedEffectsManager {
  private static scene: THREE.Scene | null = null;
  
  // Shell casings
  private static casingMesh: THREE.InstancedMesh | null = null;
  private static casingData: InstanceData[] = [];
  private static casingCount: number = 0;
  private static casingGeometry: THREE.BufferGeometry | null = null;
  private static casingMaterial: THREE.MeshStandardMaterial | null = null;
  
  // Impact sparks
  private static sparkMesh: THREE.InstancedMesh | null = null;
  private static sparkData: InstanceData[] = [];
  private static sparkCount: number = 0;
  private static sparkGeometry: THREE.BufferGeometry | null = null;
  private static sparkMaterial: THREE.MeshBasicMaterial | null = null;
  
  // Debris/gibs
  private static debrisMesh: THREE.InstancedMesh | null = null;
  private static debrisData: InstanceData[] = [];
  private static debrisCount: number = 0;
  private static debrisGeometry: THREE.BufferGeometry | null = null;
  private static debrisMaterial: THREE.MeshStandardMaterial | null = null;
  
  // Matrix for instance updates
  private static dummyMatrix = new THREE.Matrix4();
  private static dummyColor = new THREE.Color();
  
  public static init(scene: THREE.Scene): void {
    if (this.scene) return;
    this.scene = scene;
    
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
    const effects = GraphicsSettings.get().effectsQuality;
    const fxScale = getParticleScale(effects);
    
    // Reduced instance counts for mobile
    const maxCasings = isTouch ? (effects === 'LOW' ? 30 : effects === 'MEDIUM' ? 50 : 80) : 200;
    const maxSparks = isTouch ? (effects === 'LOW' ? 40 : effects === 'MEDIUM' ? 80 : 120) : 300;
    const maxDebris = isTouch ? (effects === 'LOW' ? 20 : effects === 'MEDIUM' ? 40 : 60) : 150;
    
    this.casingCount = maxCasings;
    this.sparkCount = maxSparks;
    this.debrisCount = maxDebris;
    
    this.initCasings(maxCasings);
    this.initSparks(maxSparks);
    this.initDebris(maxDebris);
  }
  
  private static initCasings(count: number): void {
    // Simple brass casing geometry (cylinder)
    this.casingGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6, 1, true);
    this.casingGeometry.rotateX(Math.PI / 2);
    this.casingGeometry.translate(0, 0, -0.03);
    
    this.casingMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.3,
    });
    
    this.casingMesh = new THREE.InstancedMesh(this.casingGeometry, this.casingMaterial, count);
    this.casingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.casingMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.casingMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.casingMesh.frustumCulled = false;
    this.casingMesh.visible = true;
    this.scene!.add(this.casingMesh);
    
    this.casingData = new Array(count).fill(null).map(() => ({
      matrix: new THREE.Matrix4(),
      color: new THREE.Color(0xd4af37),
      scale: 1,
      life: 0,
      maxLife: 0.6,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      active: false,
    }));
  }
  
  private static initSparks(count: number): void {
    // Small box for sparks
    this.sparkGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.1);
    this.sparkGeometry.translate(0, 0, 0.05);
    
    this.sparkMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    this.sparkMesh = new THREE.InstancedMesh(this.sparkGeometry, this.sparkMaterial, count);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.sparkMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.visible = true;
    this.scene!.add(this.sparkMesh);
    
    this.sparkData = new Array(count).fill(null).map(() => ({
      matrix: new THREE.Matrix4(),
      color: new THREE.Color(0xffe066),
      scale: 1,
      life: 0,
      maxLife: 0.3,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      active: false,
    }));
  }
  
  private static initDebris(count: number): void {
    // Mixed debris geometry
    this.debrisGeometry = new THREE.BoxGeometry(0.05, 0.03, 0.08);
    
    this.debrisMaterial = new THREE.MeshStandardMaterial({
      color: 0x6e1b23,
      roughness: 0.8,
      metalness: 0.05,
    });
    
    this.debrisMesh = new THREE.InstancedMesh(this.debrisGeometry, this.debrisMaterial, count);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.debrisMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.visible = true;
    this.debrisMesh.castShadow = true;
    this.scene!.add(this.debrisMesh);
    
    this.debrisData = new Array(count).fill(null).map(() => ({
      matrix: new THREE.Matrix4(),
      color: new THREE.Color(0x6e1b23),
      scale: 1,
      life: 0,
      maxLife: 1.0,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      active: false,
    }));
  }
  
  /** Spawn a shell casing ejection */
  public static spawnCasing(position: THREE.Vector3, direction: THREE.Vector3): void {
    if (!this.casingMesh) return;
    
    // Find inactive slot
    let index = -1;
    for (let i = 0; i < this.casingCount; i++) {
      if (!this.casingData[i].active) {
        index = i;
        break;
      }
    }
    if (index === -1) return; // Pool exhausted
    
    const data = this.casingData[index];
    data.active = true;
    data.life = 0;
    data.maxLife = 0.5 + Math.random() * 0.3;
    data.scale = 1.0;
    data.color.setHex(0xd4af37);
    
    data.velocity.set(
      direction.x * 3.5 + (Math.random() - 0.5) * 0.5,
      2.5 + Math.random() * 0.8,
      direction.z * 3.5 + (Math.random() - 0.5) * 0.5
    );
    data.angularVelocity.set(
      Math.random() * 20 - 10,
      Math.random() * 20 - 10,
      Math.random() * 10 - 5
    );
    
    this.updateInstanceMatrix(index, data, position);
  }
  
  /** Spawn impact sparks at a point */
  public static spawnSparks(position: THREE.Vector3, normal: THREE.Vector3, count: number = 8): void {
    if (!this.sparkMesh) return;
    
    for (let i = 0; i < count; i++) {
      let index = -1;
      for (let j = 0; j < this.sparkCount; j++) {
        if (!this.sparkData[j].active) {
          index = j;
          break;
        }
      }
      if (index === -1) break;
      
      const data = this.sparkData[index];
      data.active = true;
      data.life = 0;
      data.maxLife = 0.2 + Math.random() * 0.15;
      data.scale = 0.5 + Math.random() * 0.5;
      data.color.setHex(0xffe066);
      
      // Spark velocity: reflect off surface + random spread
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
      data.velocity.copy(normal).multiplyScalar(2).add(spread);
      data.angularVelocity.set(0, 0, 0);
      
      this.updateInstanceMatrix(index, data, position);
    }
  }
  
  /** Spawn flesh/bone debris (gibs) */
  public static spawnDebris(position: THREE.Vector3, count: number = 6, isFlesh: boolean = true): void {
    if (!this.debrisMesh) return;
    
    for (let i = 0; i < count; i++) {
      let index = -1;
      for (let j = 0; j < this.debrisCount; j++) {
        if (!this.debrisData[j].active) {
          index = j;
          break;
        }
      }
      if (index === -1) break;
      
      const data = this.debrisData[index];
      data.active = true;
      data.life = 0;
      data.maxLife = 0.8 + Math.random() * 0.6;
      data.scale = 0.5 + Math.random() * 1.0;
      
      if (isFlesh) {
        data.color.setHex(0x6e1b23);
      } else {
        data.color.setHex(0xe2ded4);
      }
      
      // Explode outward
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      data.velocity.set(
        Math.cos(angle) * speed,
        Math.random() * 4 + 1.5,
        Math.sin(angle) * speed
      );
      data.angularVelocity.set(
        Math.random() * 10 - 5,
        Math.random() * 10 - 5,
        Math.random() * 10 - 5
      );
      
      this.updateInstanceMatrix(index, data, position);
    }
  }
  
  private static updateInstanceMatrix(index: number, data: InstanceData, position: THREE.Vector3): void {
    this.dummyMatrix.makeRotationFromEuler(new THREE.Euler(0, 0, 0));
    this.dummyMatrix.setPosition(position);
    this.dummyMatrix.scale(new THREE.Vector3(data.scale, data.scale, data.scale));
    
    if (this.casingMesh && index < this.casingCount) {
      this.casingMesh.setMatrixAt(index, this.dummyMatrix);
      this.casingMesh.setColorAt(index, data.color);
    } else if (this.sparkMesh && index < this.sparkCount) {
      this.sparkMesh.setMatrixAt(index, this.dummyMatrix);
      this.sparkMesh.setColorAt(index, data.color);
    } else if (this.debrisMesh && index < this.debrisCount) {
      this.debrisMesh.setMatrixAt(index, this.dummyMatrix);
      this.debrisMesh.setColorAt(index, data.color);
    }
  }
  
  public static update(delta: number): void {
    if (!this.casingMesh || !this.sparkMesh || !this.debrisMesh) return;
    
    let casingNeedsUpdate = false;
    let sparkNeedsUpdate = false;
    let debrisNeedsUpdate = false;
    
    // Update casings
    for (let i = 0; i < this.casingCount; i++) {
      const data = this.casingData[i];
      if (!data.active) continue;
      
      data.life += delta;
      if (data.life >= data.maxLife) {
        data.active = false;
        // Hide by moving far away
        this.dummyMatrix.makeTranslation(9999, 9999, 9999);
        this.casingMesh.setMatrixAt(i, this.dummyMatrix);
        casingNeedsUpdate = true;
        continue;
      }
      
      // Physics
      data.velocity.y -= 9.81 * delta * 1.2; // gravity
      const pos = new THREE.Vector3();
      this.casingMesh.getMatrixAt(i, this.dummyMatrix);
      pos.setFromMatrixPosition(this.dummyMatrix);
      pos.addScaledVector(data.velocity, delta);
      
      // Rotation
      const rot = new THREE.Euler();
      rot.setFromRotationMatrix(this.dummyMatrix);
      rot.x += data.angularVelocity.x * delta;
      rot.y += data.angularVelocity.y * delta;
      rot.z += data.angularVelocity.z * delta;
      
      this.dummyMatrix.makeRotationFromEuler(rot);
      this.dummyMatrix.setPosition(pos);
      this.dummyMatrix.scale(new THREE.Vector3(data.scale, data.scale, data.scale));
      this.casingMesh.setMatrixAt(i, this.dummyMatrix);
      
      // Fade color
      const t = data.life / data.maxLife;
      data.color.lerp(new THREE.Color(0x333333), t * 0.5);
      this.casingMesh.setColorAt(i, data.color);
      
      casingNeedsUpdate = true;
    }
    
    // Update sparks
    for (let i = 0; i < this.sparkCount; i++) {
      const data = this.sparkData[i];
      if (!data.active) continue;
      
      data.life += delta;
      if (data.life >= data.maxLife) {
        data.active = false;
        this.dummyMatrix.makeTranslation(9999, 9999, 9999);
        this.sparkMesh.setMatrixAt(i, this.dummyMatrix);
        sparkNeedsUpdate = true;
        continue;
      }
      
      data.velocity.y -= 9.81 * delta * 2; // sparks fall faster
      const pos = new THREE.Vector3();
      this.sparkMesh.getMatrixAt(i, this.dummyMatrix);
      pos.setFromMatrixPosition(this.dummyMatrix);
      pos.addScaledVector(data.velocity, delta);
      
      this.dummyMatrix.setPosition(pos);
      this.dummyMatrix.scale(new THREE.Vector3(data.scale, data.scale, data.scale));
      this.sparkMesh.setMatrixAt(i, this.dummyMatrix);
      
      // Fade out
      const t = data.life / data.maxLife;
      const colorAttr = this.sparkMesh.instanceColor as THREE.InstancedBufferAttribute;
      colorAttr.setXYZ(i, data.color.r * (1 - t), data.color.g * (1 - t), data.color.b * (1 - t));
      colorAttr.needsUpdate = true;
      
      sparkNeedsUpdate = true;
    }
    
    // Update debris
    for (let i = 0; i < this.debrisCount; i++) {
      const data = this.debrisData[i];
      if (!data.active) continue;
      
      data.life += delta;
      if (data.life >= data.maxLife) {
        data.active = false;
        this.dummyMatrix.makeTranslation(9999, 9999, 9999);
        this.debrisMesh.setMatrixAt(i, this.dummyMatrix);
        debrisNeedsUpdate = true;
        continue;
      }
      
      data.velocity.y -= 9.81 * delta;
      const pos = new THREE.Vector3();
      this.debrisMesh.getMatrixAt(i, this.dummyMatrix);
      pos.setFromMatrixPosition(this.dummyMatrix);
      pos.addScaledVector(data.velocity, delta);
      
      const rot = new THREE.Euler();
      rot.setFromRotationMatrix(this.dummyMatrix);
      rot.x += data.angularVelocity.x * delta;
      rot.y += data.angularVelocity.y * delta;
      rot.z += data.angularVelocity.z * delta;
      
      this.dummyMatrix.makeRotationFromEuler(rot);
      this.dummyMatrix.setPosition(pos);
      this.dummyMatrix.scale(new THREE.Vector3(data.scale, data.scale, data.scale));
      this.debrisMesh.setMatrixAt(i, this.dummyMatrix);
      
      debrisNeedsUpdate = true;
    }
    
    if (casingNeedsUpdate) this.casingMesh.instanceMatrix.needsUpdate = true;
    if (sparkNeedsUpdate) this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (debrisNeedsUpdate) this.debrisMesh.instanceMatrix.needsUpdate = true;
    
    if (this.casingMesh.instanceColor) this.casingMesh.instanceColor.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
  }
  
  public static dispose(): void {
    if (!this.scene) return;
    
    if (this.casingMesh) {
      this.scene.remove(this.casingMesh);
      this.casingMesh.geometry.dispose();
      this.casingMesh.material.dispose();
      this.casingMesh = null;
    }
    if (this.sparkMesh) {
      this.scene.remove(this.sparkMesh);
      this.sparkMesh.geometry.dispose();
      this.sparkMesh.material.dispose();
      this.sparkMesh = null;
    }
    if (this.debrisMesh) {
      this.scene.remove(this.debrisMesh);
      this.debrisMesh.geometry.dispose();
      this.debrisMesh.material.dispose();
      this.debrisMesh = null;
    }
    
    this.casingData = [];
    this.sparkData = [];
    this.debrisData = [];
    this.scene = null;
  }
  
  public static reinit(scene: THREE.Scene): void {
    this.dispose();
    this.init(scene);
  }
}