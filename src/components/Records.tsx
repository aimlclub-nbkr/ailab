@@ -246,7 +246,8 @@ const Records: React.FC = () => {
               vivaCompleted: !!vivaAttempt,
               vivaScore: vivaAttempt?.score,
               vivaDate: vivaAttempt?.completedAt,
-              submissionLink: submission.submissionLink
+              submissionLink: submission.submissionLink || submission.submissionUrl || submission.link,
+              submissionId: submission.id
             });
           }
         });
@@ -358,7 +359,8 @@ const Records: React.FC = () => {
               vivaCompleted: !!vivaAttempt,
               vivaScore: vivaAttempt?.score,
               vivaDate: vivaAttempt?.completedAt,
-              submissionLink: submission.submissionLink
+              submissionLink: submission.submissionLink || submission.submissionUrl || submission.link,
+              submissionId: submission.id
             });
           }
         });
@@ -376,6 +378,7 @@ const Records: React.FC = () => {
   const openSubmissionLink = (link: string) => {
     if (link) {
       window.open(link, '_blank', 'noopener,noreferrer');
+    } else {
+      alert('No submission link available for this record.');
     }
   };
 
@@ -640,11 +643,15 @@ const Records: React.FC = () => {
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                             Approved
                           </span>
-                          <button
-                            onClick={() => openSubmissionLink(record.submissionLink!)}
-                            className="text-blue-600 hover:text-blue-800 text-xs"
-                          >
-                            View
-                          </button>
+                          {record.submissionLink ? (
+                            <button
+                              onClick={() => openSubmissionLink(record.submissionLink!)}
+                              className="text-blue-600 hover:text-blue-800 text-xs"
+                            >
+                              View
+                            </button>
+                          ) : (
+                            <span className="text-gray-400 text-xs">No link</span>
+                          )}
                         </div>
                         <div className="text-xs text-gray-500">
                           Approved: {record.approvedDate?.toLocaleDateString()}