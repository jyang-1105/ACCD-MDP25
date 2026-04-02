import { MeshWobbleMaterial, Text, Float } from '@react-three/drei';

export default function GreeBoBox({ color, isUnboxing, onOpen }) {
  return (
    <Float speed={1.5}>
      <mesh onClick={onOpen}>
        <boxGeometry args={[2, 2, 2]} />
        <MeshWobbleMaterial 
          color={color}  // 这里接收来自表单的颜色
          factor={isUnboxing ? 1.5 : 0.15} 
          speed={2} 
        />
        <Text position={[0, 0, 1.01]} fontSize={0.2} color="white">
          FOR YOUR PET
        </Text>
      </mesh>
    </Float>
  );
}