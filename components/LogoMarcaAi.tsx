import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface LogoMarcaAiProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
  style?: any;
}

export default function LogoMarcaAi({ 
  size = 'medium', 
  showTagline = true, 
  style 
}: LogoMarcaAiProps) {
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          containerSize: 40,
          iconSize: 20,
          titleFontSize: 16,
          taglineFontSize: 10,
          spacing: 4
        };
      case 'large':
        return {
          containerSize: 80,
          iconSize: 40,
          titleFontSize: 28,
          taglineFontSize: 14,
          spacing: 8
        };
      default: // medium
        return {
          containerSize: 60,
          iconSize: 30,
          titleFontSize: 22,
          taglineFontSize: 12,
          spacing: 6
        };
    }
  };

  const config = getSizeConfig();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.logoRow}>
        {/* Quadrado azul com M */}
        <View style={[
          styles.iconContainer, 
          { 
            width: config.containerSize, 
            height: config.containerSize,
            borderRadius: config.containerSize * 0.2
          }
        ]}>
          <Text style={[
            styles.iconText, 
            { fontSize: config.iconSize }
          ]}>
            M
          </Text>
        </View>
        
        {/* Texto MarcaAi */}
        <View style={styles.textContainer}>
          <Text style={[
            styles.title, 
            { fontSize: config.titleFontSize }
          ]}>
            MarcaAi
          </Text>
          {showTagline && (
            <Text style={[
              styles.tagline, 
              { fontSize: config.taglineFontSize }
            ]}>
              Agenda & Finanças
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#333333',
    fontWeight: 'bold',
    fontFamily: 'System',
    marginBottom: 2,
  },
  tagline: {
    color: '#666666',
    fontFamily: 'System',
    fontWeight: '400',
  },
});
