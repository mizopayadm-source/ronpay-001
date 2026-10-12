import { getSupabase } from './src/lib/supabase';

async function checkTransactionCount() {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("Supabase not configured");
    return;
  }
  
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error("Error fetching count:", error);
  } else {
    console.log("Transaction count in Supabase:", count);
  }
}

checkTransactionCount();
