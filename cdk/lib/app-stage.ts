import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import { StorageStack } from "./storage-stack";
import { AppStack } from "./app-stack";
import { CdnStack } from "./cdn-stack";

export class AppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: cdk.StageProps) {
    super(scope, id, props);

    const storageStack = new StorageStack(this, "StorageStack");
    const appStack = new AppStack(this, "AppStack", {
      vpc: storageStack.vpc,
      bucket: storageStack.bucket,
    });
    new CdnStack(this, "CdnStack", {
      loadBalancer: appStack.loadbalancer,
      bucket: storageStack.bucket,
      originAccessIdentity: storageStack.originAccessIdentity,
    });
  }
}
