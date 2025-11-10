import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ctulmpyaikxsnjqmrzxf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dWxtcHlhaWt4c25qcW1yenhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzkxMjMsImV4cCI6MjA3MzIxNTEyM30.bu0gER4uTIZ5PDV7t1-fcwU01UZAJ6aFG6axFZQlU8U';

// Cliente real do Supabase com persistência de sessão
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
