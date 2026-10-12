import { getSupabase } from './src/lib/supabase';
import { deleteMultipleSupabaseTransactions } from './src/services/supabaseService';

async function cleanupAllTransactions() {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("Supabase not configured");
    return;
  }
  
  // Fetch all
  const { data, error } = await supabase
    .from('transactions')
    .select('id');
    
  if (error || !data) {
    console.error("Error fetching transactions:", error);
    return;
  }
  
  const ids = data.map((t: any) => t.id);
  console.log(`Deleting ${ids.length} transactions...`);
  
  const success = await deleteMultipleSupabaseTransactions(ids);
  console.log("Cleanup status:", success ? "Success" : "Failed");
}

cleanupAllTransactions();
