(() => {
  "use strict";
  const root=document.getElementById("community-root");
  const load=async()=>{
    try {
      if(!Raben.configured())throw new Error("Die Anmeldung wird noch eingerichtet.");
      if(document.body.dataset.communityPage==="application")await RabenHub.mountApplication(root);
      else await RabenHub.mountPublic(root);
    } catch(error) {
      root.replaceChildren();
      Raben.status("community-status",Raben.errorMessage(error),true);
    }
  };
  if(Raben.configured())Raben.client().auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")window.dispatchEvent(new Event("raben-lock"));});
  load();
})();
