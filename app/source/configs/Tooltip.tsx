import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal } from 'react-native';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  navigateTo?: string; // For navigation actions
  onPress?: () => void; // For custom functions
}

const Tooltip: React.FC<TooltipProps> = ({ text, children, navigateTo, onPress }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity] = useState(new Animated.Value(0));
  const navigation = useNavigation<any>();

  const handlePressIn = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setPosition({ x: pageX, y: pageY });
    setVisible(true);
    
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const handlePress = () => {
    // Execute the appropriate action
    if (navigateTo) {
      navigation.navigate(navigateTo);
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
      
      <Modal
        transparent={true}
        visible={visible}
        animationType="none"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={handlePressOut}
        >
          <Animated.View
            style={[
              styles.tooltip,
              {
                left: position.x - 50,
                top: position.y + 10,
                opacity,
              },
            ]}
          >
            <Text style={styles.tooltipText}>{text}</Text>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    minWidth: 100,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default Tooltip;
